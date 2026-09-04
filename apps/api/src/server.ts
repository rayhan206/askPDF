import { GeminiProvider } from "@askpdf/ai";
import { loadServerConfig } from "@askpdf/config";
import { connectDatabase, disconnectDatabase } from "@askpdf/database";
import { createLogger } from "@askpdf/observability";
import { AskPdfQueues } from "@askpdf/queue";
import { ObjectStorage } from "@askpdf/storage";
import { AuthService } from "./application/auth-service.js";
import { ResourceService } from "./application/resource-service.js";
import { createApp } from "./app.js";

const config = loadServerConfig();
const logger = createLogger(config.LOG_LEVEL);
await connectDatabase(config.MONGODB_URI);
const storage = new ObjectStorage({
  endpoint: config.STORAGE_ENDPOINT,
  region: config.STORAGE_REGION,
  bucket: config.STORAGE_BUCKET,
  accessKeyId: config.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
  forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
});
const queues = new AskPdfQueues({
  redisUrl: config.REDIS_URL,
  keyPrefix: config.REDIS_KEY_PREFIX,
  attempts: config.JOB_ATTEMPTS,
  backoffBaseMs: config.JOB_BACKOFF_BASE_MS,
});
const ai = config.GEMINI_API_KEY
  ? new GeminiProvider({
      apiKey: config.GEMINI_API_KEY,
      embeddingModel: config.GEMINI_EMBEDDING_MODEL,
      generationModel: config.GEMINI_GENERATION_MODEL,
      embeddingDimension: config.GEMINI_EMBEDDING_DIMENSION,
      timeoutMs: config.GEMINI_REQUEST_TIMEOUT_MS,
    })
  : null;
const authService = new AuthService(config);
const resourceService = new ResourceService(config, storage, queues, ai);
const app = createApp(config, { authService, resourceService, storage, queues, logger });
const server = app.listen(config.API_PORT, config.API_HOST, () =>
  logger.info({ host: config.API_HOST, port: config.API_PORT }, "api listening"),
);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "api shutting down");
  server.close();
  await Promise.allSettled([queues.close(), disconnectDatabase()]);
  storage.destroy();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
