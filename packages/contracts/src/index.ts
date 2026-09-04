import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export const uuidSchema = z.uuid();
export const isoDateSchema = z.iso.datetime({ offset: true });
export const phoneE164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/);
export const passwordSchema = z.string().min(12).max(128);

export const workspaceRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export const documentStatusSchema = z.enum([
  "awaiting_upload",
  "queued",
  "validating",
  "extracting",
  "cleaning",
  "chunking",
  "embedding",
  "indexing",
  "ready",
  "failed",
  "cancelled",
  "deleting",
]);
export const processingStageSchema = z.enum([
  "queued",
  "validating",
  "extracting",
  "cleaning",
  "chunking",
  "embedding",
  "indexing",
  "ready",
  "failed",
  "cancelled",
]);

export const errorCodeSchema = z.enum([
  "ACCOUNT_DISABLED",
  "AI_PROVIDER_ERROR",
  "AUTHENTICATION_REQUIRED",
  "CITATION_NOT_FOUND",
  "CITATION_VALIDATION_FAILED",
  "COLLECTION_NAME_EXISTS",
  "COLLECTION_NOT_FOUND",
  "CONVERSATION_NOT_FOUND",
  "CSRF_INVALID",
  "DEPENDENCY_UNAVAILABLE",
  "DOCUMENT_NOT_AVAILABLE",
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_NOT_READY",
  "DOCUMENT_VERSION_CHANGED",
  "DUPLICATE_REQUEST",
  "EMAIL_ALREADY_EXISTS",
  "FILE_TOO_LARGE",
  "FORBIDDEN",
  "INTERNAL_ERROR",
  "INVALID_CREDENTIALS",
  "INVALID_SESSION",
  "MESSAGE_NOT_FOUND",
  "PHONE_ALREADY_EXISTS",
  "PROCESSING_REJECTED",
  "PROGRESS_UNAVAILABLE",
  "RATE_LIMITED",
  "SEARCH_UNAVAILABLE",
  "SESSION_REUSE_DETECTED",
  "STATE_CONFLICT",
  "STORAGE_UNAVAILABLE",
  "UNSUPPORTED_FILE_TYPE",
  "UPLOAD_INTENT_NOT_FOUND",
  "UPLOAD_NOT_FOUND",
  "VALIDATION_ERROR",
]);

export const errorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: errorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
    details: z
      .array(z.strictObject({ path: z.string().min(1), issue: z.string().min(1) }))
      .optional(),
  }),
});

export const registerRequestSchema = z
  .strictObject({
    email: z
      .email()
      .transform((value) => value.trim().toLowerCase())
      .optional(),
    phone: phoneE164Schema.optional(),
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(80),
  })
  .refine((value) => Number(Boolean(value.email)) + Number(Boolean(value.phone)) === 1, {
    message: "Provide exactly one email or phone number",
    path: ["email"],
  });

export const loginRequestSchema = z.strictObject({
  identifier: z.string().trim().min(3).max(254),
  password: passwordSchema,
});

export const createUploadIntentRequestSchema = z.strictObject({
  workspaceId: objectIdSchema,
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  contentType: z.literal("application/pdf"),
});

export const completeUploadRequestSchema = z.strictObject({ workspaceId: objectIdSchema });
export const updateDocumentRequestSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(160),
});
export const reprocessDocumentRequestSchema = z.strictObject({
  reason: z.enum(["manual_retry", "configuration_change", "admin_reindex"]),
});
export const cancelDocumentRequestSchema = z.strictObject({
  processingVersion: z.number().int().positive(),
});

export const createCollectionRequestSchema = z.strictObject({
  workspaceId: objectIdSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  documentIds: z.array(objectIdSchema).max(100).default([]),
});

export const updateCollectionRequestSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    documentIds: z.array(objectIdSchema).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const createConversationRequestSchema = z.strictObject({
  workspaceId: objectIdSchema,
  title: z.string().trim().min(1).max(120).default("New conversation"),
  selectedDocumentIds: z.array(objectIdSchema).min(1).max(20),
  collectionId: objectIdSchema.nullable().default(null),
});

export const updateConversationRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const askQuestionRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(4000),
  clientRequestId: uuidSchema,
});

export const documentIngestJobSchema = z.strictObject({
  schemaVersion: z.literal(1),
  documentId: objectIdSchema,
  processingVersion: z.number().int().positive(),
  processingRunId: objectIdSchema,
  correlationId: z.string().min(1).max(128),
});

export const documentDeleteJobSchema = z.strictObject({
  schemaVersion: z.literal(1),
  documentId: objectIdSchema,
  correlationId: z.string().min(1).max(128),
});

export const progressEventSchema = z.strictObject({
  documentId: objectIdSchema,
  processingVersion: z.number().int().positive(),
  stage: processingStageSchema,
  stageSequence: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  message: z.string().min(1).max(300),
  occurredAt: isoDateSchema,
});

export const citationSchema = z.strictObject({
  id: objectIdSchema,
  documentId: objectIdSchema,
  documentName: z.string().min(1).max(160),
  chunkId: objectIdSchema,
  processingVersion: z.number().int().positive(),
  pageNumber: z.number().int().positive(),
  excerpt: z.string().min(1).max(600),
  ordinal: z.number().int().nonnegative(),
});

export const generatedAnswerSchema = z.strictObject({
  claims: z
    .array(
      z.strictObject({
        id: z.string().regex(/^claim-\d+$/),
        text: z.string().trim().min(1).max(2000),
        citations: z
          .array(
            z.strictObject({
              chunkId: objectIdSchema,
              pageNumber: z.number().int().positive(),
              excerpt: z.string().trim().min(1).max(600),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type CreateUploadIntentRequest = z.infer<typeof createUploadIntentRequestSchema>;
export type DocumentIngestJob = z.infer<typeof documentIngestJobSchema>;
export type DocumentDeleteJob = z.infer<typeof documentDeleteJobSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type GeneratedAnswer = z.infer<typeof generatedAnswerSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const QUEUE_NAMES = {
  documentIngest: "documents.ingest.v1",
  documentDelete: "documents.delete.v1",
} as const;

export function dataEnvelope<T>(data: T): { data: T } {
  return { data };
}
