import { z } from "zod";

const booleanFromString = z.enum(["true", "false"]).transform((value) => value === "true");

const serverEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    PORT: z.coerce.number().int().min(1).max(65535).optional(),
    API_PUBLIC_URL: z.url().default("http://localhost:4000"),
    WORKER_PUBLIC_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.url().optional(),
    ),
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
    MONGODB_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
    REDIS_KEY_PREFIX: z.string().min(1).default("askpdf:local"),
    STORAGE_ENDPOINT: z.url(),
    STORAGE_REGION: z.string().min(1).default("us-east-1"),
    STORAGE_BUCKET: z.string().min(3),
    STORAGE_ACCESS_KEY_ID: z.string().min(3),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(8),
    STORAGE_FORCE_PATH_STYLE: booleanFromString.default(() => true),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_PEPPER: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1).default("askpdf-api"),
    JWT_AUDIENCE: z.string().min(1).default("askpdf-web"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
    ACCESS_COOKIE_NAME: z.string().min(1).default("askpdf_access"),
    REFRESH_COOKIE_NAME: z.string().min(1).default("askpdf_refresh"),
    COOKIE_SECURE: booleanFromString.default(() => false),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    GEMINI_API_KEY: z.string().default(""),
    AI_LOCAL_FALLBACK: booleanFromString.default(() => true),
    GEMINI_GENERATION_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    GEMINI_EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-001"),
    GEMINI_EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(768),
    GEMINI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(104857600),
    MAX_DOCUMENT_PAGES: z.coerce.number().int().positive().default(500),
    MAX_EXTRACTED_TEXT_CHARACTERS: z.coerce.number().int().positive().default(10000000),
    MAX_TEMP_BYTES_PER_JOB: z.coerce.number().int().positive().default(157286400),
    PDF_PAGE_BATCH_SIZE: z.coerce.number().int().positive().default(10),
    EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(32),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().max(32).default(2),
    JOB_ATTEMPTS: z.coerce.number().int().positive().max(10).default(3),
    JOB_BACKOFF_BASE_MS: z.coerce.number().int().positive().default(2000),
    CHUNK_TARGET_CHARACTERS: z.coerce.number().int().positive().default(2600),
    CHUNK_OVERLAP_CHARACTERS: z.coerce.number().int().nonnegative().default(400),
    RETRIEVAL_TOP_K: z.coerce.number().int().positive().max(50).default(8),
    MIN_EVIDENCE_SCORE: z.coerce.number().min(0).max(1).default(0.35),
    MAX_CONTEXT_CHARACTERS: z.coerce.number().int().positive().default(28000),
    UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    READ_URL_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    RATE_LIMIT_API_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(120),
    RATE_LIMIT_AUTH_ATTEMPTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_GENERATION_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
    FEATURE_ANSWER_STREAMING: booleanFromString.default(() => true),
  })
  .superRefine((configuration, context) => {
    if (configuration.NODE_ENV === "production" && !configuration.GEMINI_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required in production",
      });
    }
  })
  .transform((configuration) => ({
    ...configuration,
    API_PORT: configuration.API_PORT ?? configuration.PORT ?? 4000,
  }));

export type ServerConfig = z.infer<typeof serverEnvironmentSchema>;

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return serverEnvironmentSchema.parse(environment);
}
