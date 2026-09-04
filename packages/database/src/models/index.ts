import mongoose, { type Model, type Schema as MongooseSchema, type Types } from "mongoose";

const { Schema, model, models } = mongoose;

export interface UserRecord {
  email?: string;
  phoneE164?: string;
  passwordHash: string;
  displayName: string;
  status: "active" | "disabled";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phoneE164: { type: String, match: /^\+[1-9]\d{7,14}$/ },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    status: { type: String, enum: ["active", "disabled"], default: "active", required: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw", optimisticConcurrency: true, versionKey: "schemaVersion" },
);
userSchema.index(
  { email: 1 },
  { unique: true, sparse: true, collation: { locale: "en", strength: 2 } },
);
userSchema.index({ phoneE164: 1 }, { unique: true, sparse: true });
userSchema.index({ status: 1, createdAt: -1 });

export interface WorkspaceRecord {
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  plan: "free" | "project";
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<WorkspaceRecord>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    plan: { type: String, enum: ["free", "project"], default: "free", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw", optimisticConcurrency: true, versionKey: "schemaVersion" },
);
workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ ownerId: 1, deletedAt: 1 });

export interface WorkspaceMemberRecord {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "owner" | "admin" | "member" | "viewer";
  invitedByUserId: Types.ObjectId | null;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceMemberSchema = new Schema<WorkspaceMemberRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    role: { type: String, enum: ["owner", "admin", "member", "viewer"], required: true },
    invitedByUserId: { type: Schema.Types.ObjectId, default: null, ref: "User" },
    joinedAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMemberSchema.index({ userId: 1, workspaceId: 1 });
workspaceMemberSchema.index({ workspaceId: 1, role: 1 });

export interface AuthSessionRecord {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgentHash: string;
  ipPrefix: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<AuthSessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    refreshTokenHash: { type: String, required: true, select: false },
    userAgentHash: { type: String, required: true },
    ipPrefix: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBySessionId: { type: Schema.Types.ObjectId, default: null, ref: "AuthSession" },
  },
  { timestamps: true, strict: "throw" },
);
authSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ refreshTokenHash: 1 }, { unique: true, sparse: true });

export interface UploadIntentRecord {
  workspaceId: Types.ObjectId;
  requestedByUserId: Types.ObjectId;
  objectKey: string;
  originalFilename: string;
  declaredContentType: "application/pdf";
  expectedSizeBytes: number;
  expectedSha256: string;
  status: "pending" | "uploaded" | "completed" | "aborted" | "expired";
  expiresAt: Date;
  completedAt: Date | null;
  documentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const uploadIntentSchema = new Schema<UploadIntentRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    requestedByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    objectKey: { type: String, required: true, select: false },
    originalFilename: { type: String, required: true, trim: true, maxlength: 255 },
    declaredContentType: { type: String, enum: ["application/pdf"], required: true },
    expectedSizeBytes: { type: Number, required: true, min: 1 },
    expectedSha256: { type: String, required: true, match: /^[a-f\d]{64}$/ },
    status: {
      type: String,
      enum: ["pending", "uploaded", "completed", "aborted", "expired"],
      default: "pending",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    documentId: { type: Schema.Types.ObjectId, default: null, ref: "Document" },
  },
  { timestamps: true, strict: "throw" },
);
uploadIntentSchema.index({ objectKey: 1 }, { unique: true });
uploadIntentSchema.index({ workspaceId: 1, requestedByUserId: 1, status: 1, createdAt: -1 });
uploadIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export type DocumentStatus =
  | "awaiting_upload"
  | "queued"
  | "validating"
  | "extracting"
  | "cleaning"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "failed"
  | "cancelled"
  | "deleting";

export interface DocumentRecord {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  uploadedByUserId: Types.ObjectId;
  uploadIntentId: Types.ObjectId;
  storageBucket: string;
  storageKey: string;
  originalFilename: string;
  displayName: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  sha256: string;
  pageCount: number | null;
  status: DocumentStatus;
  activeProcessingVersion: number;
  readyProcessingVersion: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<DocumentRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    uploadedByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    uploadIntentId: { type: Schema.Types.ObjectId, required: true, ref: "UploadIntent" },
    storageBucket: { type: String, required: true, select: false },
    storageKey: { type: String, required: true, select: false },
    originalFilename: { type: String, required: true, maxlength: 255 },
    displayName: { type: String, required: true, trim: true, maxlength: 160 },
    mimeType: { type: String, enum: ["application/pdf"], required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, match: /^[a-f\d]{64}$/, select: false },
    pageCount: { type: Number, default: null, min: 1 },
    status: { type: String, required: true },
    activeProcessingVersion: { type: Number, default: 1, min: 1 },
    readyProcessingVersion: { type: Number, default: null, min: 1 },
    failureCode: { type: String, default: null, maxlength: 100 },
    failureMessage: { type: String, default: null, maxlength: 300 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw", optimisticConcurrency: true, versionKey: "schemaVersion" },
);
documentSchema.index({ workspaceId: 1, storageKey: 1 }, { unique: true });
documentSchema.index({ workspaceId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
documentSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
documentSchema.index({ workspaceId: 1, sha256: 1, deletedAt: 1 });

export interface ProcessingRunRecord {
  workspaceId: Types.ObjectId;
  documentId: Types.ObjectId;
  processingVersion: number;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage: DocumentStatus;
  stageSequence: number;
  progressPercent: number;
  attemptCount: number;
  cancelRequestedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  expectedChunkCount: number | null;
  storedChunkCount: number;
  extractedPageCount: number;
  chunkingVersion: string;
  embeddingModel: string;
  embeddingDimension: number;
  processingConfigurationVersion: string;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const processingRunSchema = new Schema<ProcessingRunRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document" },
    processingVersion: { type: Number, required: true, min: 1 },
    jobId: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      required: true,
    },
    stage: { type: String, required: true },
    stageSequence: { type: Number, required: true, min: 0 },
    progressPercent: { type: Number, required: true, min: 0, max: 100 },
    attemptCount: { type: Number, default: 0, min: 0 },
    cancelRequestedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    expectedChunkCount: { type: Number, default: null, min: 0 },
    storedChunkCount: { type: Number, default: 0, min: 0 },
    extractedPageCount: { type: Number, default: 0, min: 0 },
    chunkingVersion: { type: String, required: true },
    embeddingModel: { type: String, required: true },
    embeddingDimension: { type: Number, required: true, min: 1 },
    processingConfigurationVersion: { type: String, required: true },
    errorCode: { type: String, default: null, maxlength: 100 },
  },
  { timestamps: true, strict: "throw" },
);
processingRunSchema.index({ documentId: 1, processingVersion: 1 }, { unique: true });
processingRunSchema.index({ jobId: 1 }, { unique: true });
processingRunSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });

export interface DocumentChunkRecord {
  workspaceId: Types.ObjectId;
  documentId: Types.ObjectId;
  processingVersion: number;
  stableChunkId: string;
  ordinal: number;
  text: string;
  lexicalText: string;
  pageStart: number;
  pageEnd: number;
  sourceSpans: Array<{ pageNumber: number; startOffset: number; endOffset: number }>;
  headingPath: string[];
  tokenCount: number;
  contentHash: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDimension: number;
  createdAt: Date;
  updatedAt: Date;
}

const documentChunkSchema = new Schema<DocumentChunkRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document" },
    processingVersion: { type: Number, required: true, min: 1 },
    stableChunkId: { type: String, required: true },
    ordinal: { type: Number, required: true, min: 0 },
    text: { type: String, required: true },
    lexicalText: { type: String, required: true },
    pageStart: { type: Number, required: true, min: 1 },
    pageEnd: { type: Number, required: true, min: 1 },
    sourceSpans: [
      {
        _id: false,
        pageNumber: { type: Number, required: true, min: 1 },
        startOffset: { type: Number, required: true, min: 0 },
        endOffset: { type: Number, required: true, min: 0 },
      },
    ],
    headingPath: [{ type: String }],
    tokenCount: { type: Number, required: true, min: 1 },
    contentHash: { type: String, required: true, match: /^[a-f\d]{64}$/ },
    embedding: { type: [Number], required: true, select: false },
    embeddingModel: { type: String, required: true },
    embeddingDimension: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, strict: "throw" },
);
documentChunkSchema.index(
  { documentId: 1, processingVersion: 1, stableChunkId: 1 },
  { unique: true },
);
documentChunkSchema.index({ workspaceId: 1, documentId: 1, processingVersion: 1, ordinal: 1 });

export interface CollectionRecord {
  workspaceId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  name: string;
  description: string;
  documentIds: Types.ObjectId[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const collectionSchema = new Schema<CollectionRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    documentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);
collectionSchema.index({ workspaceId: 1, deletedAt: 1, updatedAt: -1 });
collectionSchema.index(
  { workspaceId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    collation: { locale: "en", strength: 2 },
  },
);

export interface ConversationRecord {
  workspaceId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  title: string;
  selectedDocumentIds: Types.ObjectId[];
  collectionId: Types.ObjectId | null;
  collectionUpdatedAtSnapshot: Date | null;
  summary: string | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    selectedDocumentIds: [{ type: Schema.Types.ObjectId, required: true, ref: "Document" }],
    collectionId: { type: Schema.Types.ObjectId, default: null, ref: "DocumentCollection" },
    collectionUpdatedAtSnapshot: { type: Date, default: null },
    summary: { type: String, default: null, maxlength: 4000 },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: "throw" },
);
conversationSchema.index({
  workspaceId: 1,
  createdByUserId: 1,
  deletedAt: 1,
  updatedAt: -1,
  _id: -1,
});

export interface MessageRecord {
  workspaceId: Types.ObjectId;
  conversationId: Types.ObjectId;
  role: "user" | "assistant";
  status: "pending" | "completed" | "failed";
  content: string;
  clientRequestId: string | null;
  normalizedQuestionHash: string | null;
  replyToMessageId: Types.ObjectId | null;
  insufficientEvidence: boolean;
  modelName: string | null;
  promptVersion: string | null;
  retrievalConfigurationVersion: string | null;
  retrievedChunkIds: Types.ObjectId[];
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: "Conversation" },
    role: { type: String, enum: ["user", "assistant"], required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], required: true },
    content: { type: String, required: true, maxlength: 20000 },
    clientRequestId: { type: String, default: null },
    normalizedQuestionHash: { type: String, default: null, select: false },
    replyToMessageId: { type: Schema.Types.ObjectId, default: null, ref: "Message" },
    insufficientEvidence: { type: Boolean, default: false },
    modelName: { type: String, default: null },
    promptVersion: { type: String, default: null },
    retrievalConfigurationVersion: { type: String, default: null },
    retrievedChunkIds: [{ type: Schema.Types.ObjectId, ref: "DocumentChunk", select: false }],
    latencyMs: { type: Number, default: null, min: 0 },
    inputTokens: { type: Number, default: null, min: 0 },
    outputTokens: { type: Number, default: null, min: 0 },
    failureCode: { type: String, default: null },
  },
  { timestamps: true, strict: "throw" },
);
messageSchema.index({ workspaceId: 1, conversationId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ conversationId: 1, clientRequestId: 1 }, { unique: true, sparse: true });
messageSchema.index({ replyToMessageId: 1, role: 1 }, { unique: true, sparse: true });

export interface CitationRecord {
  workspaceId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageId: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkId: Types.ObjectId;
  processingVersion: number;
  pageNumber: number;
  excerpt: string;
  claimIds: string[];
  ordinal: number;
  createdAt: Date;
  updatedAt: Date;
}

const citationSchema = new Schema<CitationRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: "Conversation" },
    messageId: { type: Schema.Types.ObjectId, required: true, ref: "Message" },
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document" },
    chunkId: { type: Schema.Types.ObjectId, required: true, ref: "DocumentChunk" },
    processingVersion: { type: Number, required: true, min: 1 },
    pageNumber: { type: Number, required: true, min: 1 },
    excerpt: { type: String, required: true, minlength: 1, maxlength: 600 },
    claimIds: [{ type: String, required: true }],
    ordinal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, strict: "throw" },
);
citationSchema.index({ messageId: 1, ordinal: 1 }, { unique: true });
citationSchema.index({ workspaceId: 1, conversationId: 1, messageId: 1 });
citationSchema.index({ workspaceId: 1, documentId: 1, processingVersion: 1 });

export interface AuditEventRecord {
  workspaceId: Types.ObjectId;
  actorUserId: Types.ObjectId | null;
  action: string;
  targetType: string;
  targetId: Types.ObjectId | null;
  correlationId: string;
  metadata: Map<string, string | number | boolean | null>;
  createdAt: Date;
}

const auditEventSchema = new Schema<AuditEventRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    actorUserId: { type: Schema.Types.ObjectId, default: null, ref: "User" },
    action: { type: String, required: true },
    targetType: { type: String, required: true, maxlength: 80 },
    targetId: { type: Schema.Types.ObjectId, default: null },
    correlationId: { type: String, required: true, maxlength: 128 },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true, immutable: true, default: Date.now },
  },
  { strict: "throw", versionKey: false },
);
auditEventSchema.index({ workspaceId: 1, createdAt: -1, _id: -1 });
auditEventSchema.index({ workspaceId: 1, action: 1, createdAt: -1 });
auditEventSchema.index({ correlationId: 1 });

function registeredModel<T>(name: string, schema: MongooseSchema<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const UserModel = registeredModel("User", userSchema);
export const WorkspaceModel = registeredModel("Workspace", workspaceSchema);
export const WorkspaceMemberModel = registeredModel("WorkspaceMember", workspaceMemberSchema);
export const AuthSessionModel = registeredModel("AuthSession", authSessionSchema);
export const UploadIntentModel = registeredModel("UploadIntent", uploadIntentSchema);
export const DocumentModel = registeredModel("Document", documentSchema);
export const ProcessingRunModel = registeredModel("DocumentProcessingRun", processingRunSchema);
export const DocumentChunkModel = registeredModel("DocumentChunk", documentChunkSchema);
export const CollectionModel = registeredModel("DocumentCollection", collectionSchema);
export const ConversationModel = registeredModel("Conversation", conversationSchema);
export const MessageModel = registeredModel("Message", messageSchema);
export const CitationModel = registeredModel("Citation", citationSchema);
export const AuditEventModel = registeredModel("AuditEvent", auditEventSchema);
