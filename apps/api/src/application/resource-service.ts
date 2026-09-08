import { createHash, randomUUID } from "node:crypto";
import mongoose, { type Types as MongooseTypes } from "mongoose";
import { z } from "zod";
import type { ServerConfig } from "@askpdf/config";
import type { CreateUploadIntentRequest, GeneratedAnswer } from "@askpdf/contracts";
import {
  CitationModel,
  CollectionModel,
  ConversationModel,
  DocumentChunkModel,
  DocumentModel,
  MessageModel,
  ProcessingRunModel,
  UploadIntentModel,
  WorkspaceMemberModel,
} from "@askpdf/database";
import type { AiProvider } from "@askpdf/ai";
import { buildIngestJobId, type AskPdfQueues } from "@askpdf/queue";
import { citationExcerptIsValid, reciprocalRankFusion } from "@askpdf/rag";
import type { ObjectStorage } from "@askpdf/storage";
import { AppError, notFound } from "./errors.js";

const { Types } = mongoose;
const ANSWER_PROMPT_VERSION = "answer-v3";
const RETRIEVAL_CONFIGURATION_VERSION = "hybrid-v2";

const LOCAL_RETRIEVAL_STOP_WORDS = new Set([
  "about",
  "and",
  "are",
  "can",
  "describe",
  "described",
  "document",
  "does",
  "explain",
  "for",
  "from",
  "how",
  "pdf",
  "please",
  "say",
  "that",
  "the",
  "this",
  "what",
  "which",
  "with",
]);

function localTerms(value: string): string[] {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((term) => term.length > 2 && !LOCAL_RETRIEVAL_STOP_WORDS.has(term));
}

function localEditDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function localLexicalScore(questionTerms: string[], text: string): number {
  const candidateTerms = new Set(localTerms(text));
  return questionTerms.reduce((score, questionTerm) => {
    if (candidateTerms.has(questionTerm)) return score + 3;
    const fuzzyMatch = [...candidateTerms].some(
      (candidateTerm) =>
        Math.min(questionTerm.length, candidateTerm.length) >= 5 &&
        localEditDistance(questionTerm, candidateTerm) <= 2,
    );
    return score + (fuzzyMatch ? 1 : 0);
  }, 0);
}

const retrievalRecordSchema = z.strictObject({
  _id: z.unknown(),
  documentId: z.unknown(),
  processingVersion: z.number().int().positive(),
  text: z.string().min(1),
  pageStart: z.number().int().positive(),
  score: z.number(),
});

type Role = "owner" | "admin" | "member" | "viewer";

interface Evidence {
  id: string;
  documentId: string;
  processingVersion: number;
  text: string;
  pageNumber: number;
  vectorRank?: number;
  lexicalRank?: number;
  score: number;
}

function id(value: MongooseTypes.ObjectId): string {
  return value.toHexString();
}

function documentDto(document: {
  _id: MongooseTypes.ObjectId;
  displayName: string;
  originalFilename: string;
  sizeBytes: number;
  pageCount: number | null;
  status: string;
  activeProcessingVersion: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: id(document._id),
    displayName: document.displayName,
    originalFilename: document.originalFilename,
    sizeBytes: document.sizeBytes,
    pageCount: document.pageCount,
    status: document.status,
    processingVersion: document.activeProcessingVersion,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export class ResourceService {
  constructor(
    private readonly config: ServerConfig,
    private readonly storage: ObjectStorage,
    private readonly queues: AskPdfQueues,
    private readonly ai: AiProvider | null,
  ) {}

  async requireMembership(
    workspaceId: string,
    userId: string,
    roles: Role[] = ["owner", "admin", "member", "viewer"],
  ): Promise<Role> {
    const membership = await WorkspaceMemberModel.findOne({ workspaceId, userId }).lean();
    if (!membership || !roles.includes(membership.role))
      throw new AppError(403, "FORBIDDEN", "You do not have access to this workspace.");
    return membership.role;
  }

  async createUploadIntent(input: CreateUploadIntentRequest, userId: string) {
    await this.requireMembership(input.workspaceId, userId, ["owner", "admin", "member"]);
    if (input.sizeBytes > this.config.MAX_UPLOAD_BYTES)
      throw new AppError(413, "FILE_TOO_LARGE", "The PDF exceeds the configured upload limit.");
    const objectKey = `${input.workspaceId}/${randomUUID()}`;
    const expiresAt = new Date(Date.now() + this.config.UPLOAD_URL_TTL_SECONDS * 1000);
    const intent = await UploadIntentModel.create({
      workspaceId: input.workspaceId,
      requestedByUserId: userId,
      objectKey,
      originalFilename: input.filename.replace(/[\u0000-\u001f]/g, "").trim(),
      declaredContentType: input.contentType,
      expectedSizeBytes: input.sizeBytes,
      expectedSha256: input.sha256,
      expiresAt,
    });
    const url = await this.storage.createUploadUrl(
      objectKey,
      input.contentType,
      input.sha256,
      this.config.UPLOAD_URL_TTL_SECONDS,
    );
    return {
      uploadIntentId: id(intent._id),
      upload: {
        method: "PUT" as const,
        url,
        headers: { "Content-Type": input.contentType, "x-amz-meta-sha256": input.sha256 },
        expiresAt: expiresAt.toISOString(),
        maxSizeBytes: this.config.MAX_UPLOAD_BYTES,
      },
    };
  }

  async completeUpload(
    uploadIntentId: string,
    workspaceId: string,
    userId: string,
    correlationId: string,
  ) {
    await this.requireMembership(workspaceId, userId, ["owner", "admin", "member"]);
    const intent = await UploadIntentModel.findOne({
      _id: uploadIntentId,
      workspaceId,
      requestedByUserId: userId,
    }).select("+objectKey");
    if (!intent) throw notFound("UPLOAD_INTENT_NOT_FOUND", "upload intent");
    if (intent.status === "completed" && intent.documentId) {
      const existing = await DocumentModel.findOne({
        _id: intent.documentId,
        workspaceId,
        deletedAt: null,
      });
      if (!existing)
        throw new AppError(409, "STATE_CONFLICT", "The completed upload no longer has a document.");
      return {
        document: documentDto(existing),
        job: {
          id: buildIngestJobId(id(existing._id), existing.activeProcessingVersion),
          status: "queued" as const,
        },
      };
    }
    if (intent.status !== "pending" || intent.expiresAt <= new Date())
      throw new AppError(409, "STATE_CONFLICT", "The upload intent is no longer active.");
    const metadata = await this.storage.head(intent.objectKey).catch(() => {
      throw new AppError(409, "UPLOAD_NOT_FOUND", "The uploaded object could not be verified.");
    });
    if (
      metadata.contentLength !== intent.expectedSizeBytes ||
      metadata.sha256 !== intent.expectedSha256 ||
      metadata.contentType !== "application/pdf"
    ) {
      throw new AppError(
        409,
        "UPLOAD_NOT_FOUND",
        "The uploaded object metadata does not match the upload intent.",
      );
    }
    const prefix = await this.storage.readPrefix(intent.objectKey, 5);
    if (new TextDecoder().decode(prefix) !== "%PDF-")
      throw new AppError(415, "UNSUPPORTED_FILE_TYPE", "The uploaded object is not a PDF.");

    const transaction = await mongoose.startSession();
    let documentId: MongooseTypes.ObjectId | undefined;
    let runId: MongooseTypes.ObjectId | undefined;
    try {
      await transaction.withTransaction(async () => {
        const [document] = await DocumentModel.create(
          [
            {
              workspaceId,
              ownerId: userId,
              uploadedByUserId: userId,
              uploadIntentId: intent._id,
              storageBucket: this.storage.bucket,
              storageKey: intent.objectKey,
              originalFilename: intent.originalFilename,
              displayName: intent.originalFilename.slice(0, 160),
              mimeType: "application/pdf",
              sizeBytes: metadata.contentLength,
              sha256: intent.expectedSha256,
              status: "queued",
              activeProcessingVersion: 1,
            },
          ],
          { session: transaction },
        );
        if (!document) throw new AppError(500, "INTERNAL_ERROR", "Document creation failed.");
        documentId = document._id;
        const jobId = buildIngestJobId(id(document._id), 1);
        const [run] = await ProcessingRunModel.create(
          [
            {
              workspaceId,
              documentId: document._id,
              processingVersion: 1,
              jobId,
              status: "queued",
              stage: "queued",
              stageSequence: 0,
              progressPercent: 0,
              chunkingVersion: "chunk-v1",
              embeddingModel: this.ai?.embeddingModel ?? this.config.GEMINI_EMBEDDING_MODEL,
              embeddingDimension: this.config.GEMINI_EMBEDDING_DIMENSION,
              processingConfigurationVersion: "processing-v1",
            },
          ],
          { session: transaction },
        );
        if (!run) throw new AppError(500, "INTERNAL_ERROR", "Processing run creation failed.");
        runId = run._id;
        intent.status = "completed";
        intent.completedAt = new Date();
        intent.documentId = document._id;
        await intent.save({ session: transaction });
      });
      if (!documentId || !runId)
        throw new AppError(
          500,
          "INTERNAL_ERROR",
          "Upload completion did not create processing state.",
        );
      const jobId = await this.queues.enqueueIngest({
        schemaVersion: 1,
        documentId: id(documentId),
        processingVersion: 1,
        processingRunId: id(runId),
        correlationId,
      });
      const document = await DocumentModel.findById(documentId);
      if (!document) throw new AppError(500, "INTERNAL_ERROR", "Created document was not found.");
      return { document: documentDto(document), job: { id: jobId, status: "queued" as const } };
    } catch (error: unknown) {
      if (documentId)
        await DocumentModel.updateOne(
          { _id: documentId, workspaceId },
          {
            $set: {
              status: "failed",
              failureCode: "QUEUE_UNAVAILABLE",
              failureMessage: "Processing could not be scheduled.",
            },
          },
        );
      throw error;
    } finally {
      await transaction.endSession();
    }
  }

  async listDocuments(workspaceId: string, userId: string, query?: string) {
    await this.requireMembership(workspaceId, userId);
    const escapedQuery = query?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const documents = await DocumentModel.find({
      workspaceId,
      deletedAt: null,
      ...(escapedQuery ? { displayName: { $regex: escapedQuery, $options: "i" } } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100);
    return { items: documents.map(documentDto), nextCursor: null };
  }

  async getDocument(documentId: string, userId: string) {
    const document = await DocumentModel.findOne({ _id: documentId, deletedAt: null });
    if (!document) throw notFound("DOCUMENT_NOT_FOUND", "document");
    await this.requireMembership(id(document.workspaceId), userId);
    const run = await ProcessingRunModel.findOne({
      workspaceId: document.workspaceId,
      documentId,
      processingVersion: document.activeProcessingVersion,
    }).lean();
    return {
      document: documentDto(document),
      processing: run
        ? {
            stage: run.stage,
            progressPercent: run.progressPercent,
            stageSequence: run.stageSequence,
            errorCode: run.errorCode,
          }
        : null,
    };
  }

  async updateDocument(documentId: string, userId: string, displayName: string) {
    const document = await DocumentModel.findOne({ _id: documentId, deletedAt: null });
    if (!document) throw notFound("DOCUMENT_NOT_FOUND", "document");
    await this.requireMembership(id(document.workspaceId), userId, ["owner", "admin", "member"]);
    document.displayName = displayName;
    await document.save();
    return documentDto(document);
  }

  async deleteDocument(documentId: string, userId: string, correlationId: string) {
    const document = await DocumentModel.findOne({ _id: documentId, deletedAt: null });
    if (!document) return { documentId, deletionScheduled: true };
    await this.requireMembership(id(document.workspaceId), userId, ["owner", "admin", "member"]);
    if (document.status !== "deleting") {
      document.status = "deleting";
      await document.save();
      await ProcessingRunModel.updateMany(
        { workspaceId: document.workspaceId, documentId, status: { $in: ["queued", "running"] } },
        { $set: { cancelRequestedAt: new Date() } },
      );
    }
    await this.queues.enqueueDelete({ schemaVersion: 1, documentId, correlationId });
    return { documentId, deletionScheduled: true };
  }

  async reprocessDocument(documentId: string, userId: string, correlationId: string) {
    const document = await DocumentModel.findOne({
      _id: documentId,
      deletedAt: null,
      status: { $ne: "deleting" },
    });
    if (!document) throw notFound("DOCUMENT_NOT_FOUND", "document");
    await this.requireMembership(id(document.workspaceId), userId, ["owner", "admin", "member"]);
    document.activeProcessingVersion += 1;
    document.status = "queued";
    document.failureCode = null;
    document.failureMessage = null;
    await document.save();
    const jobId = buildIngestJobId(id(document._id), document.activeProcessingVersion);
    const run = await ProcessingRunModel.create({
      workspaceId: document.workspaceId,
      documentId: document._id,
      processingVersion: document.activeProcessingVersion,
      jobId,
      status: "queued",
      stage: "queued",
      stageSequence: 0,
      progressPercent: 0,
      chunkingVersion: "chunk-v1",
      embeddingModel: this.ai?.embeddingModel ?? this.config.GEMINI_EMBEDDING_MODEL,
      embeddingDimension: this.config.GEMINI_EMBEDDING_DIMENSION,
      processingConfigurationVersion: "processing-v1",
    });
    await this.queues.enqueueIngest({
      schemaVersion: 1,
      documentId,
      processingVersion: document.activeProcessingVersion,
      processingRunId: id(run._id),
      correlationId,
    });
    return {
      documentId,
      status: "queued",
      processingVersion: document.activeProcessingVersion,
      jobId,
    };
  }

  async cancelDocument(documentId: string, userId: string, processingVersion: number) {
    const document = await DocumentModel.findOne({ _id: documentId, deletedAt: null });
    if (!document) throw notFound("DOCUMENT_NOT_FOUND", "document");
    await this.requireMembership(id(document.workspaceId), userId, ["owner", "admin", "member"]);
    if (
      document.activeProcessingVersion !== processingVersion ||
      ["ready", "failed", "cancelled"].includes(document.status)
    )
      throw new AppError(409, "STATE_CONFLICT", "The requested run is stale or terminal.");
    await ProcessingRunModel.updateOne(
      {
        workspaceId: document.workspaceId,
        documentId,
        processingVersion,
        status: { $in: ["queued", "running"] },
      },
      { $set: { cancelRequestedAt: new Date() } },
    );
    return { documentId, processingVersion, cancelRequested: true };
  }

  async createViewUrl(documentId: string, userId: string, page?: number) {
    const document = await DocumentModel.findOne({
      _id: documentId,
      deletedAt: null,
      status: { $ne: "deleting" },
    }).select("+storageKey");
    if (!document) throw notFound("DOCUMENT_NOT_FOUND", "document");
    await this.requireMembership(id(document.workspaceId), userId);
    if (
      page !== undefined &&
      (page < 1 || (document.pageCount !== null && page > document.pageCount))
    )
      throw new AppError(400, "VALIDATION_ERROR", "The page number is outside this document.");
    return {
      url: await this.storage.createReadUrl(document.storageKey, this.config.READ_URL_TTL_SECONDS),
      expiresAt: new Date(Date.now() + this.config.READ_URL_TTL_SECONDS * 1000).toISOString(),
      page: page ?? 1,
    };
  }

  async createCollection(
    input: { workspaceId: string; name: string; description: string; documentIds: string[] },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId, ["owner", "admin", "member"]);
    const count = await DocumentModel.countDocuments({
      _id: { $in: input.documentIds },
      workspaceId: input.workspaceId,
      deletedAt: null,
    });
    if (count !== input.documentIds.length) throw notFound("DOCUMENT_NOT_FOUND", "document");
    try {
      const collection = await CollectionModel.create({ ...input, createdByUserId: userId });
      return {
        id: id(collection._id),
        name: collection.name,
        description: collection.description,
        documentIds: collection.documentIds.map(id),
        createdAt: collection.createdAt.toISOString(),
      };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000)
        throw new AppError(
          409,
          "COLLECTION_NAME_EXISTS",
          "A collection with that name already exists.",
        );
      throw error;
    }
  }

  async listCollections(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId);
    const collections = await CollectionModel.find({ workspaceId, deletedAt: null }).sort({
      updatedAt: -1,
    });
    return {
      items: collections.map((item) => ({
        id: id(item._id),
        name: item.name,
        description: item.description,
        documentIds: item.documentIds.map(id),
        updatedAt: item.updatedAt.toISOString(),
      })),
      nextCursor: null,
    };
  }

  async updateCollection(
    collectionId: string,
    userId: string,
    input: {
      name?: string | undefined;
      description?: string | undefined;
      documentIds?: string[] | undefined;
    },
  ) {
    const collection = await CollectionModel.findOne({ _id: collectionId, deletedAt: null });
    if (!collection) throw notFound("COLLECTION_NOT_FOUND", "collection");
    await this.requireMembership(id(collection.workspaceId), userId, ["owner", "admin", "member"]);
    if (input.documentIds) {
      const count = await DocumentModel.countDocuments({
        _id: { $in: input.documentIds },
        workspaceId: collection.workspaceId,
        deletedAt: null,
      });
      if (count !== input.documentIds.length) throw notFound("DOCUMENT_NOT_FOUND", "document");
      collection.documentIds = input.documentIds.map((value) => new Types.ObjectId(value));
    }
    if (input.name !== undefined) collection.name = input.name;
    if (input.description !== undefined) collection.description = input.description;
    await collection.save();
    return {
      id: id(collection._id),
      name: collection.name,
      description: collection.description,
      documentIds: collection.documentIds.map(id),
      updatedAt: collection.updatedAt.toISOString(),
    };
  }

  async deleteCollection(collectionId: string, userId: string) {
    const collection = await CollectionModel.findOne({ _id: collectionId, deletedAt: null });
    if (!collection) return;
    await this.requireMembership(id(collection.workspaceId), userId, ["owner", "admin", "member"]);
    collection.deletedAt = new Date();
    await collection.save();
  }

  async createConversation(
    input: {
      workspaceId: string;
      title: string;
      selectedDocumentIds: string[];
      collectionId: string | null;
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId);
    const documents = await DocumentModel.find({
      _id: { $in: input.selectedDocumentIds },
      workspaceId: input.workspaceId,
      status: "ready",
      deletedAt: null,
    });
    if (documents.length !== input.selectedDocumentIds.length)
      throw new AppError(
        409,
        "DOCUMENT_NOT_READY",
        "Every selected document must be authorized and ready.",
      );
    const conversation = await ConversationModel.create({ ...input, createdByUserId: userId });
    return {
      id: id(conversation._id),
      title: conversation.title,
      selectedDocumentIds: conversation.selectedDocumentIds.map(id),
      collectionId: conversation.collectionId ? id(conversation.collectionId) : null,
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  async listConversations(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId);
    const conversations = await ConversationModel.find({
      workspaceId,
      createdByUserId: userId,
      deletedAt: null,
    })
      .sort({ updatedAt: -1 })
      .limit(100);
    return {
      items: conversations.map((item) => ({
        id: id(item._id),
        title: item.title,
        selectedDocumentCount: item.selectedDocumentIds.length,
        updatedAt: item.updatedAt.toISOString(),
      })),
      nextCursor: null,
    };
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      createdByUserId: userId,
      deletedAt: null,
    });
    if (!conversation) throw notFound("CONVERSATION_NOT_FOUND", "conversation");
    await this.requireMembership(id(conversation.workspaceId), userId);
    const [messages, citations, documents] = await Promise.all([
      MessageModel.find({ workspaceId: conversation.workspaceId, conversationId })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      CitationModel.find({ workspaceId: conversation.workspaceId, conversationId })
        .sort({ ordinal: 1 })
        .lean(),
      DocumentModel.find({
        _id: { $in: conversation.selectedDocumentIds },
        workspaceId: conversation.workspaceId,
        deletedAt: null,
      })
        .select("displayName")
        .lean(),
    ]);
    const documentNames = new Map(
      documents.map((document) => [id(document._id), document.displayName]),
    );
    const citationsByMessage = new Map<string, typeof citations>();
    for (const citation of citations) {
      const key = id(citation.messageId);
      citationsByMessage.set(key, [...(citationsByMessage.get(key) ?? []), citation]);
    }
    return {
      conversation: {
        id: id(conversation._id),
        title: conversation.title,
        selectedDocumentIds: conversation.selectedDocumentIds.map(id),
        collectionId: conversation.collectionId ? id(conversation.collectionId) : null,
      },
      messages: {
        items: messages.map((message) => ({
          id: id(message._id),
          role: message.role,
          status: message.status,
          content: message.content,
          insufficientEvidence: message.insufficientEvidence,
          createdAt: message.createdAt.toISOString(),
          citations: (citationsByMessage.get(id(message._id)) ?? []).map((citation) => ({
            id: id(citation._id),
            documentId: id(citation.documentId),
            documentName: documentNames.get(id(citation.documentId)) ?? "Document",
            chunkId: id(citation.chunkId),
            processingVersion: citation.processingVersion,
            pageNumber: citation.pageNumber,
            excerpt: citation.excerpt,
            ordinal: citation.ordinal,
          })),
        })),
        nextCursor: null,
      },
    };
  }

  async updateConversation(
    conversationId: string,
    userId: string,
    input: { title?: string | undefined; archived?: boolean | undefined },
  ) {
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      createdByUserId: userId,
      deletedAt: null,
    });
    if (!conversation) throw notFound("CONVERSATION_NOT_FOUND", "conversation");
    await this.requireMembership(id(conversation.workspaceId), userId);
    if (input.title !== undefined) conversation.title = input.title;
    if (input.archived !== undefined) conversation.archivedAt = input.archived ? new Date() : null;
    await conversation.save();
    return {
      id: id(conversation._id),
      title: conversation.title,
      archivedAt: conversation.archivedAt?.toISOString() ?? null,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      createdByUserId: userId,
      deletedAt: null,
    });
    if (!conversation) return;
    await this.requireMembership(id(conversation.workspaceId), userId);
    conversation.deletedAt = new Date();
    await conversation.save();
  }

  async getCitationSource(citationId: string, userId: string) {
    const citation = await CitationModel.findById(citationId).lean();
    if (!citation) throw notFound("CITATION_NOT_FOUND", "citation");
    await this.requireMembership(id(citation.workspaceId), userId);
    const document = await DocumentModel.findOne({
      _id: citation.documentId,
      workspaceId: citation.workspaceId,
      status: "ready",
      readyProcessingVersion: citation.processingVersion,
      deletedAt: null,
    }).select("+storageKey");
    if (!document)
      throw new AppError(
        409,
        "DOCUMENT_NOT_AVAILABLE",
        "The cited document version is no longer available.",
      );
    return {
      citationId,
      documentId: id(document._id),
      documentName: document.displayName,
      pageNumber: citation.pageNumber,
      excerpt: citation.excerpt,
      url: await this.storage.createReadUrl(document.storageKey, this.config.READ_URL_TTL_SECONDS),
      expiresAt: new Date(Date.now() + this.config.READ_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async askQuestion(
    conversationId: string,
    userId: string,
    question: string,
    clientRequestId: string,
  ) {
    const startedAt = Date.now();
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      createdByUserId: userId,
      deletedAt: null,
    });
    if (!conversation) throw notFound("CONVERSATION_NOT_FOUND", "conversation");
    await this.requireMembership(id(conversation.workspaceId), userId);
    const duplicate = await MessageModel.findOne({
      workspaceId: conversation.workspaceId,
      conversationId,
      clientRequestId,
    });
    if (duplicate) {
      const answer = await MessageModel.findOne({
        workspaceId: conversation.workspaceId,
        conversationId,
        replyToMessageId: duplicate._id,
      });
      if (answer)
        return this.answerResponse(
          duplicate,
          answer,
          await CitationModel.find({ messageId: answer._id }),
          false,
        );
      throw new AppError(409, "DUPLICATE_REQUEST", "The matching request is still in progress.");
    }
    const documents = await DocumentModel.find({
      _id: { $in: conversation.selectedDocumentIds },
      workspaceId: conversation.workspaceId,
      status: "ready",
      deletedAt: null,
    });
    if (
      documents.length !== conversation.selectedDocumentIds.length ||
      documents.some((item) => item.readyProcessingVersion !== item.activeProcessingVersion)
    ) {
      throw new AppError(
        409,
        "DOCUMENT_NOT_READY",
        "One or more selected documents are not ready at the active version.",
      );
    }
    const userMessage = await MessageModel.create({
      workspaceId: conversation.workspaceId,
      conversationId,
      role: "user",
      status: "pending",
      content: question,
      clientRequestId,
      normalizedQuestionHash: createHash("sha256")
        .update(question.trim().toLowerCase())
        .digest("hex"),
    });
    const ai = this.ai;
    if (!ai) {
      userMessage.status = "failed";
      userMessage.failureCode = "AI_PROVIDER_ERROR";
      await userMessage.save();
      throw new AppError(502, "AI_PROVIDER_ERROR", "Gemini is not configured.");
    }
    try {
      const evidence = await this.retrieve(conversation.workspaceId, documents, question);
      if (evidence.length === 0) {
        const refusal = await MessageModel.create({
          workspaceId: conversation.workspaceId,
          conversationId,
          role: "assistant",
          status: "completed",
          content:
            "I could not find enough evidence in the selected documents to answer this question.",
          replyToMessageId: userMessage._id,
          insufficientEvidence: true,
          promptVersion: ANSWER_PROMPT_VERSION,
          retrievalConfigurationVersion: RETRIEVAL_CONFIGURATION_VERSION,
          latencyMs: Date.now() - startedAt,
        });
        userMessage.status = "completed";
        await userMessage.save();
        return this.answerResponse(userMessage, refusal, [], false);
      }
      const documentNames = new Map(documents.map((item) => [id(item._id), item.displayName]));
      const generated = await ai.answer(
        question,
        evidence.map((item) => ({
          chunkId: item.id,
          documentName: documentNames.get(item.documentId) ?? "Document",
          pageNumber: item.pageNumber,
          text: item.text,
        })),
      );
      const validated = this.validateGeneratedAnswer(generated, evidence);
      const transaction = await mongoose.startSession();
      try {
        let answerId: MongooseTypes.ObjectId | undefined;
        await transaction.withTransaction(async () => {
          const [answer] = await MessageModel.create(
            [
              {
                workspaceId: conversation.workspaceId,
                conversationId,
                role: "assistant",
                status: "completed",
                content: generated.claims.map((claim) => claim.text).join("\n\n"),
                replyToMessageId: userMessage._id,
                insufficientEvidence: false,
                modelName: ai.generationModel,
                promptVersion: ANSWER_PROMPT_VERSION,
                retrievalConfigurationVersion: RETRIEVAL_CONFIGURATION_VERSION,
                retrievedChunkIds: evidence.map((item) => item.id),
                latencyMs: Date.now() - startedAt,
              },
            ],
            { session: transaction, ordered: true },
          );
          if (!answer) throw new AppError(500, "INTERNAL_ERROR", "Answer persistence failed.");
          answerId = answer._id;
          await CitationModel.create(
            validated.map((citation, ordinal) => ({
              workspaceId: conversation.workspaceId,
              conversationId,
              messageId: answer._id,
              documentId: citation.documentId,
              chunkId: citation.chunkId,
              processingVersion: citation.processingVersion,
              pageNumber: citation.pageNumber,
              excerpt: citation.excerpt,
              claimIds: citation.claimIds,
              ordinal,
            })),
            { session: transaction, ordered: true },
          );
          userMessage.status = "completed";
          await userMessage.save({ session: transaction });
        });
        if (!answerId)
          throw new AppError(500, "INTERNAL_ERROR", "Answer persistence did not complete.");
        const answer = await MessageModel.findById(answerId);
        if (!answer) throw new AppError(500, "INTERNAL_ERROR", "Persisted answer was not found.");
        return this.answerResponse(
          userMessage,
          answer,
          await CitationModel.find({ messageId: answerId }).sort({ ordinal: 1 }),
          false,
          documentNames,
        );
      } finally {
        await transaction.endSession();
      }
    } catch (error: unknown) {
      if (userMessage.status === "pending") {
        userMessage.status = "failed";
        userMessage.failureCode = error instanceof AppError ? error.code : "AI_PROVIDER_ERROR";
        await userMessage.save();
      }
      throw error;
    }
  }

  private async retrieve(
    workspaceId: MongooseTypes.ObjectId,
    documents: Array<{ _id: MongooseTypes.ObjectId; activeProcessingVersion: number }>,
    question: string,
  ): Promise<Evidence[]> {
    const vector = (await this.ai?.embed([question]))?.[0];
    if (!vector) throw new AppError(502, "AI_PROVIDER_ERROR", "Question embedding failed.");
    const filters = documents.map((document) => ({
      documentId: document._id,
      processingVersion: document.activeProcessingVersion,
    }));
    let vectorResults: Evidence[] = [];
    let lexicalResults: Evidence[];
    try {
      const rawVector: unknown[] = await DocumentChunkModel.aggregate([
        {
          $vectorSearch: {
            index: "document_chunks_vector_v1",
            path: "embedding",
            queryVector: vector,
            numCandidates: 40,
            limit: 20,
            filter: { workspaceId, $or: filters },
          },
        },
        {
          $project: {
            documentId: 1,
            processingVersion: 1,
            text: 1,
            pageStart: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ]);
      vectorResults = rawVector.map((item, index) =>
        this.evidenceFromRecord(item, index + 1, "vector"),
      );
      const rawLexical: unknown[] = await DocumentChunkModel.aggregate([
        {
          $search: {
            index: "document_chunks_lexical_v1",
            compound: {
              must: [{ text: { query: question, path: ["lexicalText", "headingPath"] } }],
              filter: [
                { equals: { path: "workspaceId", value: workspaceId } },
                { in: { path: "documentId", value: documents.map((item) => item._id) } },
              ],
            },
          },
        },
        { $limit: 20 },
        {
          $project: {
            documentId: 1,
            processingVersion: 1,
            text: 1,
            pageStart: 1,
            score: { $meta: "searchScore" },
          },
        },
      ]);
      lexicalResults = rawLexical.map((item, index) =>
        this.evidenceFromRecord(item, index + 1, "lexical"),
      );
    } catch {
      if (this.config.NODE_ENV === "production")
        throw new AppError(503, "SEARCH_UNAVAILABLE", "Hybrid search is unavailable.");
      const questionTerms = localTerms(question).slice(0, 12);
      const local = await DocumentChunkModel.find({
        workspaceId,
        $or: filters,
      })
        .select("documentId processingVersion text lexicalText pageStart ordinal")
        .limit(2_000)
        .lean();
      lexicalResults = local
        .map((item) => ({ item, score: localLexicalScore(questionTerms, item.lexicalText) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score || left.item.ordinal - right.item.ordinal)
        .slice(0, 20)
        .map(({ item, score }, index) => ({
          id: id(item._id),
          documentId: id(item.documentId),
          processingVersion: item.processingVersion,
          text: item.text,
          pageNumber: item.pageStart,
          lexicalRank: index + 1,
          score,
        }));
    }
    const evidenceById = new Map(
      [...vectorResults, ...lexicalResults].map((item) => [item.id, item]),
    );
    return reciprocalRankFusion(
      [...vectorResults, ...lexicalResults].map((item) => ({
        id: item.id,
        ...(item.vectorRank === undefined ? {} : { vectorRank: item.vectorRank }),
        ...(item.lexicalRank === undefined ? {} : { lexicalRank: item.lexicalRank }),
        score: item.score,
      })),
    )
      .slice(0, this.config.RETRIEVAL_TOP_K)
      .map((ranked) => evidenceById.get(ranked.id))
      .filter((item): item is Evidence => item !== undefined);
  }

  private evidenceFromRecord(value: unknown, rank: number, mode: "vector" | "lexical"): Evidence {
    const record = retrievalRecordSchema.parse(value);
    const chunkId = String(record._id);
    const documentId = String(record.documentId);
    return {
      id: chunkId,
      documentId,
      processingVersion: record.processingVersion,
      text: record.text,
      pageNumber: record.pageStart,
      ...(mode === "vector" ? { vectorRank: rank } : { lexicalRank: rank }),
      score: record.score,
    };
  }

  private validateGeneratedAnswer(generated: GeneratedAnswer, evidence: Evidence[]) {
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const grouped = new Map<
      string,
      {
        documentId: string;
        chunkId: string;
        processingVersion: number;
        pageNumber: number;
        excerpt: string;
        claimIds: string[];
      }
    >();
    for (const claim of generated.claims) {
      for (const citation of claim.citations) {
        const source = evidenceById.get(citation.chunkId);
        if (
          !source ||
          source.pageNumber !== citation.pageNumber ||
          !citationExcerptIsValid(source.text, citation.excerpt)
        ) {
          throw new AppError(
            500,
            "CITATION_VALIDATION_FAILED",
            "The generated answer could not be verified against its sources.",
          );
        }
        const key = `${source.id}:${citation.pageNumber}:${citation.excerpt}`;
        const existing = grouped.get(key);
        if (existing) existing.claimIds.push(claim.id);
        else
          grouped.set(key, {
            documentId: source.documentId,
            chunkId: source.id,
            processingVersion: source.processingVersion,
            pageNumber: citation.pageNumber,
            excerpt: citation.excerpt,
            claimIds: [claim.id],
          });
      }
    }
    return [...grouped.values()];
  }

  private answerResponse(
    question: { _id: MongooseTypes.ObjectId; content: string; createdAt: Date },
    answer: {
      _id: MongooseTypes.ObjectId;
      status: string;
      content: string;
      insufficientEvidence: boolean;
      modelName: string | null;
      promptVersion: string | null;
      retrievalConfigurationVersion: string | null;
      latencyMs: number | null;
    },
    citations: Array<{
      _id: MongooseTypes.ObjectId;
      documentId: MongooseTypes.ObjectId;
      chunkId: MongooseTypes.ObjectId;
      processingVersion: number;
      pageNumber: number;
      excerpt: string;
      ordinal: number;
    }>,
    cached: boolean,
    documentNames: Map<string, string> = new Map(),
  ) {
    return {
      questionMessage: {
        id: id(question._id),
        role: "user" as const,
        content: question.content,
        createdAt: question.createdAt.toISOString(),
      },
      answerMessage: {
        id: id(answer._id),
        role: "assistant" as const,
        status: answer.status,
        content: answer.content,
        insufficientEvidence: answer.insufficientEvidence,
        citations: citations.map((citation) => ({
          id: id(citation._id),
          documentId: id(citation.documentId),
          documentName: documentNames.get(id(citation.documentId)) ?? "Document",
          chunkId: id(citation.chunkId),
          processingVersion: citation.processingVersion,
          pageNumber: citation.pageNumber,
          excerpt: citation.excerpt,
          ordinal: citation.ordinal,
        })),
      },
      meta: {
        cached,
        model: answer.modelName,
        promptVersion: answer.promptVersion ?? ANSWER_PROMPT_VERSION,
        retrievalConfigurationVersion:
          answer.retrievalConfigurationVersion ?? RETRIEVAL_CONFIGURATION_VERSION,
        latencyMs: answer.latencyMs ?? 0,
      },
    };
  }
}
