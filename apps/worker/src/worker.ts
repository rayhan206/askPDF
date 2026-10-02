import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Worker, UnrecoverableError, type Job } from "bullmq";
import { createAiProvider } from "@askpdf/ai";
import { loadServerConfig } from "@askpdf/config";
import {
  QUEUE_NAMES,
  documentDeleteJobSchema,
  documentIngestJobSchema,
  type DocumentDeleteJob,
  type DocumentIngestJob,
} from "@askpdf/contracts";
import {
  DocumentChunkModel,
  DocumentModel,
  ProcessingRunModel,
  connectDatabase,
  disconnectDatabase,
  type DocumentStatus,
} from "@askpdf/database";
import { createLogger } from "@askpdf/observability";
import { ProgressBus, createRedisConnection } from "@askpdf/queue";
import { chunkPages, extractPdfPages } from "@askpdf/rag";
import { ObjectStorage } from "@askpdf/storage";
import { hasReachedStage, isFinalAttempt } from "./stages/retry-state.js";

const config = loadServerConfig();
const logger = createLogger(config.LOG_LEVEL).child({ service: "worker" });

await connectDatabase(config.MONGODB_URI);

const storage = new ObjectStorage({
  endpoint: config.STORAGE_ENDPOINT,
  region: config.STORAGE_REGION,
  bucket: config.STORAGE_BUCKET,
  accessKeyId: config.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
  forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
});
const ai = createAiProvider({
  apiKey: config.GEMINI_API_KEY,
  generationModel: config.GEMINI_GENERATION_MODEL,
  embeddingModel: config.GEMINI_EMBEDDING_MODEL,
  embeddingDimension: config.GEMINI_EMBEDDING_DIMENSION,
  timeoutMs: config.GEMINI_REQUEST_TIMEOUT_MS,
  allowLocalFallback: config.NODE_ENV !== "production" && config.AI_LOCAL_FALLBACK,
});
logger.info({ aiProvider: ai.providerName }, "AI provider configured");
const progressBus = new ProgressBus(config.REDIS_URL, config.REDIS_KEY_PREFIX);
const ingestConnection = createRedisConnection(config.REDIS_URL);
const deleteConnection = createRedisConnection(config.REDIS_URL);

interface ActiveRun {
  documentId: string;
  processingVersion: number;
  processingRunId: string;
}

async function requireActiveRun(run: ActiveRun): Promise<void> {
  const [document, processing] = await Promise.all([
    DocumentModel.findOne({
      _id: run.documentId,
      activeProcessingVersion: run.processingVersion,
      deletedAt: null,
    })
      .select("_id")
      .lean(),
    ProcessingRunModel.findOne({
      _id: run.processingRunId,
      documentId: run.documentId,
      processingVersion: run.processingVersion,
    })
      .select("cancelRequestedAt status")
      .lean(),
  ]);
  if (!document || !processing) throw new UnrecoverableError("STALE_PROCESSING_VERSION");
  if (processing.cancelRequestedAt || processing.status === "cancelled") {
    throw new UnrecoverableError("PROCESSING_CANCELLED");
  }
}

async function reportStage(
  run: ActiveRun,
  stage: Exclude<DocumentStatus, "awaiting_upload" | "deleting">,
  stageSequence: number,
  progressPercent: number,
  message: string,
): Promise<void> {
  await requireActiveRun(run);
  const now = new Date();
  const updated = await ProcessingRunModel.findOneAndUpdate(
    {
      _id: run.processingRunId,
      processingVersion: run.processingVersion,
      stageSequence: { $lt: stageSequence },
      status: { $in: ["queued", "running"] },
    },
    {
      $set: {
        status: "running",
        stage,
        stageSequence,
        progressPercent,
        startedAt: now,
      },
    },
    { new: true },
  ).lean();
  if (!updated) {
    const existing = await ProcessingRunModel.findOne({
      _id: run.processingRunId,
      processingVersion: run.processingVersion,
      status: { $in: ["queued", "running"] },
    })
      .select("stageSequence")
      .lean();
    if (existing && hasReachedStage(existing.stageSequence, stageSequence)) return;
    throw new UnrecoverableError("STALE_STAGE_UPDATE");
  }
  await DocumentModel.updateOne(
    { _id: run.documentId, activeProcessingVersion: run.processingVersion, deletedAt: null },
    { $set: { status: stage, failureCode: null, failureMessage: null } },
  );
  await progressBus.publish({
    documentId: run.documentId,
    processingVersion: run.processingVersion,
    stage,
    stageSequence,
    progressPercent,
    message,
    occurredAt: now.toISOString(),
  });
}

async function downloadPdf(
  key: string,
  destination: string,
  expectedSha256: string,
): Promise<void> {
  const digest = createHash("sha256");
  let received = 0;
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > config.MAX_TEMP_BYTES_PER_JOB) {
        callback(new UnrecoverableError("TEMP_STORAGE_LIMIT_EXCEEDED"));
        return;
      }
      digest.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    await storage.openReadStream(key),
    guard,
    createWriteStream(destination, { flags: "wx" }),
  );
  if (digest.digest("hex") !== expectedSha256)
    throw new UnrecoverableError("FILE_CHECKSUM_MISMATCH");
}

async function storeChunks(
  run: ActiveRun,
  pagesPath: string,
): Promise<{ pageCount: number; chunkCount: number }> {
  const pages = await extractPdfPages(pagesPath, config.MAX_DOCUMENT_PAGES);
  const extractedCharacters = pages.reduce((total, page) => total + page.text.length, 0);
  if (extractedCharacters > config.MAX_EXTRACTED_TEXT_CHARACTERS) {
    throw new UnrecoverableError("EXTRACTED_TEXT_LIMIT_EXCEEDED");
  }
  const chunks = chunkPages(
    run.documentId,
    run.processingVersion,
    pages,
    config.CHUNK_TARGET_CHARACTERS,
    config.CHUNK_OVERLAP_CHARACTERS,
  );
  if (chunks.length === 0) throw new UnrecoverableError("PDF_CONTAINS_NO_EXTRACTABLE_TEXT");
  await ProcessingRunModel.updateOne(
    { _id: run.processingRunId, processingVersion: run.processingVersion },
    { $set: { extractedPageCount: pages.length, expectedChunkCount: chunks.length } },
  );

  const document = await DocumentModel.findById(run.documentId).select("workspaceId").lean();
  if (!document) throw new UnrecoverableError("DOCUMENT_NOT_FOUND");
  for (let offset = 0; offset < chunks.length; offset += config.EMBEDDING_BATCH_SIZE) {
    await requireActiveRun(run);
    const batch = chunks.slice(offset, offset + config.EMBEDDING_BATCH_SIZE);
    const embeddings = await ai.embed(batch.map((chunk) => chunk.text));
    const operations = batch.map((chunk, index) => {
      const embedding = embeddings[index];
      if (!embedding) throw new Error("Embedding provider returned an incomplete batch");
      return {
        updateOne: {
          filter: {
            workspaceId: document.workspaceId,
            documentId: run.documentId,
            processingVersion: run.processingVersion,
            stableChunkId: chunk.stableChunkId,
          },
          update: {
            $set: {
              ordinal: chunk.ordinal,
              text: chunk.text,
              lexicalText: chunk.lexicalText,
              pageStart: chunk.pageStart,
              pageEnd: chunk.pageEnd,
              sourceSpans: chunk.sourceSpans,
              headingPath: [],
              tokenCount: chunk.tokenCount,
              contentHash: chunk.contentHash,
              embedding,
              embeddingModel: ai.embeddingModel,
              embeddingDimension: config.GEMINI_EMBEDDING_DIMENSION,
            },
          },
          upsert: true,
        },
      };
    });
    await DocumentChunkModel.bulkWrite(operations, { ordered: false });
    await ProcessingRunModel.updateOne(
      { _id: run.processingRunId, processingVersion: run.processingVersion },
      { $set: { storedChunkCount: Math.min(offset + batch.length, chunks.length) } },
    );
  }
  return { pageCount: pages.length, chunkCount: chunks.length };
}

async function ingestDocument(job: Job<DocumentIngestJob>): Promise<void> {
  const payload = documentIngestJobSchema.parse(job.data);
  const run: ActiveRun = {
    documentId: payload.documentId,
    processingVersion: payload.processingVersion,
    processingRunId: payload.processingRunId,
  };
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "askpdf-"));
  const pdfPath = join(temporaryDirectory, "source.pdf");
  try {
    await ProcessingRunModel.updateOne({ _id: run.processingRunId }, { $inc: { attemptCount: 1 } });
    const document = await DocumentModel.findOne({
      _id: run.documentId,
      activeProcessingVersion: run.processingVersion,
      deletedAt: null,
    })
      .select("+storageKey +sha256")
      .lean();
    if (!document) throw new UnrecoverableError("DOCUMENT_NOT_FOUND_OR_STALE");

    await reportStage(run, "validating", 1, 8, "Validating the uploaded PDF");
    await downloadPdf(document.storageKey, pdfPath, document.sha256);
    await reportStage(run, "extracting", 2, 24, "Extracting page-aware text");
    await reportStage(run, "cleaning", 3, 40, "Normalizing extracted text");
    await reportStage(run, "chunking", 4, 52, "Creating deterministic page chunks");
    await reportStage(run, "embedding", 5, 64, "Generating document embeddings");
    const { pageCount, chunkCount } = await storeChunks(run, pdfPath);
    await reportStage(run, "indexing", 6, 92, "Finalizing the searchable document version");

    const completedAt = new Date();
    const documentUpdate = await DocumentModel.updateOne(
      { _id: run.documentId, activeProcessingVersion: run.processingVersion, deletedAt: null },
      {
        $set: {
          status: "ready",
          readyProcessingVersion: run.processingVersion,
          pageCount,
          failureCode: null,
          failureMessage: null,
        },
      },
    );
    if (documentUpdate.modifiedCount !== 1) throw new UnrecoverableError("STALE_READY_TRANSITION");
    await ProcessingRunModel.updateOne(
      { _id: run.processingRunId, processingVersion: run.processingVersion },
      {
        $set: {
          status: "completed",
          stage: "ready",
          stageSequence: 7,
          progressPercent: 100,
          completedAt,
          expectedChunkCount: chunkCount,
          storedChunkCount: chunkCount,
        },
      },
    );
    await progressBus.publish({
      documentId: run.documentId,
      processingVersion: run.processingVersion,
      stage: "ready",
      stageSequence: 7,
      progressPercent: 100,
      message: "Document is ready for cited questions",
      occurredAt: completedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing failure";
    const cancelled = message === "PROCESSING_CANCELLED";
    const terminal = error instanceof UnrecoverableError;
    const failed = terminal || isFinalAttempt(job.attemptsMade, job.opts.attempts);
    logger.error(
      { err: error, jobId: job.id, documentId: run.documentId },
      "Document ingestion failed",
    );
    await Promise.all([
      ProcessingRunModel.updateOne(
        { _id: run.processingRunId, processingVersion: run.processingVersion },
        {
          $set: {
            status: cancelled ? "cancelled" : failed ? "failed" : "running",
            errorCode: message.slice(0, 100),
            completedAt: cancelled || failed ? new Date() : null,
          },
        },
      ),
      failed
        ? DocumentModel.updateOne(
            {
              _id: run.documentId,
              activeProcessingVersion: run.processingVersion,
              deletedAt: null,
            },
            {
              $set: {
                status: cancelled ? "cancelled" : "failed",
                failureCode: message.slice(0, 100),
                failureMessage: cancelled
                  ? "Processing was cancelled"
                  : "The document could not be processed",
              },
            },
          )
        : Promise.resolve(),
    ]);
    if (!terminal) throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function deleteDocument(job: Job<DocumentDeleteJob>): Promise<void> {
  const payload = documentDeleteJobSchema.parse(job.data);
  const document = await DocumentModel.findOne({ _id: payload.documentId, status: "deleting" })
    .select("+storageKey")
    .lean();
  if (!document) return;
  await storage.delete(document.storageKey);
  await Promise.all([
    DocumentChunkModel.deleteMany({ workspaceId: document.workspaceId, documentId: document._id }),
    ProcessingRunModel.updateMany(
      {
        workspaceId: document.workspaceId,
        documentId: document._id,
        status: { $in: ["queued", "running"] },
      },
      { $set: { status: "cancelled", completedAt: new Date(), errorCode: "DOCUMENT_DELETED" } },
    ),
  ]);
  await DocumentModel.updateOne(
    { _id: document._id, workspaceId: document.workspaceId },
    { $set: { deletedAt: new Date(), failureCode: null, failureMessage: null } },
  );
}

const ingestWorker = new Worker<DocumentIngestJob>(QUEUE_NAMES.documentIngest, ingestDocument, {
  connection: ingestConnection,
  prefix: config.REDIS_KEY_PREFIX,
  concurrency: config.WORKER_CONCURRENCY,
  lockDuration: 120_000,
});
const deleteWorker = new Worker<DocumentDeleteJob>(QUEUE_NAMES.documentDelete, deleteDocument, {
  connection: deleteConnection,
  prefix: config.REDIS_KEY_PREFIX,
  concurrency: Math.max(1, Math.floor(config.WORKER_CONCURRENCY / 2)),
});

for (const worker of [ingestWorker, deleteWorker]) {
  worker.on("failed", (job, error) =>
    logger.error({ err: error, jobId: job?.id }, "Background job failed"),
  );
  worker.on("error", (error) => logger.error({ err: error }, "Worker connection error"));
}

logger.info({ concurrency: config.WORKER_CONCURRENCY }, "Ask-PDF worker started");

const healthServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ status: "ok", service: "askpdf-worker" }));
});
healthServer.listen(config.API_PORT, config.API_HOST, () =>
  logger.info({ host: config.API_HOST, port: config.API_PORT }, "worker health endpoint listening"),
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Worker shutdown started");
  healthServer.close();
  await Promise.all([ingestWorker.close(), deleteWorker.close()]);
  ingestConnection.disconnect();
  deleteConnection.disconnect();
  await progressBus.close();
  storage.destroy();
  await disconnectDatabase();
  logger.info("Worker shutdown completed");
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
