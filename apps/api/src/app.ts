import { createHash, randomUUID } from "node:crypto";
import { parseCookie, stringifySetCookie } from "cookie";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { z, ZodError } from "zod";
import type { ServerConfig } from "@askpdf/config";
import {
  askQuestionRequestSchema,
  cancelDocumentRequestSchema,
  completeUploadRequestSchema,
  createCollectionRequestSchema,
  createConversationRequestSchema,
  createUploadIntentRequestSchema,
  dataEnvelope,
  loginRequestSchema,
  objectIdSchema,
  progressEventSchema,
  registerRequestSchema,
  reprocessDocumentRequestSchema,
  updateDocumentRequestSchema,
  updateCollectionRequestSchema,
  updateConversationRequestSchema,
} from "@askpdf/contracts";
import { databaseReady } from "@askpdf/database";
import type { Logger } from "pino";
import type { ObjectStorage } from "@askpdf/storage";
import { createRedisConnection, type AskPdfQueues } from "@askpdf/queue";
import { AppError } from "./application/errors.js";
import type { AuthContext, AuthService, SessionResult } from "./application/auth-service.js";
import type { ResourceService } from "./application/resource-service.js";

const authContextSchema = z.strictObject({ userId: objectIdSchema, sessionId: objectIdSchema });

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}

function asyncMiddleware(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response)
      .then(() => next())
      .catch(next);
  };
}

function requestId(response: Response): string {
  return String(response.locals.requestId);
}

function auth(response: Response): AuthContext {
  return authContextSchema.parse(response.locals.auth);
}

function clientIpPrefix(request: Request): string | null {
  const value = request.ip;
  if (!value) return null;
  if (value.includes(":")) return value.split(":").slice(0, 4).join(":");
  return value.split(".").slice(0, 3).join(".");
}

function opaqueSubject(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function setAuthCookies(response: Response, config: ServerConfig, result: SessionResult): void {
  const shared = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: "/",
  } as const;
  response.append(
    "Set-Cookie",
    stringifySetCookie({
      name: config.ACCESS_COOKIE_NAME,
      value: result.accessToken,
      ...shared,
      maxAge: config.ACCESS_TOKEN_TTL_SECONDS,
    }),
  );
  response.append(
    "Set-Cookie",
    stringifySetCookie({
      name: config.REFRESH_COOKIE_NAME,
      value: result.refreshToken,
      ...shared,
      maxAge: config.REFRESH_TOKEN_TTL_SECONDS,
    }),
  );
}

export interface AppDependencies {
  authService: AuthService;
  resourceService: ResourceService;
  storage: ObjectStorage;
  queues: AskPdfQueues;
  logger: Logger;
}

export function createApp(config: ServerConfig, dependencies: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-Id"],
    }),
  );
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use((request, response, next) => {
    const incoming = request.header("X-Request-Id");
    const value = incoming && incoming.length <= 128 ? incoming : randomUUID();
    response.locals.requestId = value;
    response.setHeader("X-Request-Id", value);
    next();
  });
  app.use(
    pinoHttp({
      logger: dependencies.logger,
      customProps: (_request, response) => ({ requestId: requestId(response) }),
    }),
  );

  app.get("/health/live", (_request, response) =>
    response.json({ status: "ok", service: "askpdf-api", version: "1.0.0" }),
  );
  app.get(
    "/health/ready",
    asyncRoute(async (_request, response) => {
      if (!databaseReady())
        throw new AppError(503, "DEPENDENCY_UNAVAILABLE", "The API is not ready.");
      try {
        await Promise.all([dependencies.queues.ping(), dependencies.storage.ping()]);
      } catch (error: unknown) {
        dependencies.logger.warn({ err: error }, "readiness dependency check failed");
        throw new AppError(503, "DEPENDENCY_UNAVAILABLE", "The API is not ready.");
      }
      response.json({
        status: "ready",
        dependencies: { mongodb: "ok", redis: "ok", storage: "ok" },
      });
    }),
  );

  const rateLimit = (
    scope: string,
    limit: number,
    subject: (request: Request, response: Response) => string,
  ) =>
    asyncMiddleware(async (request, response) => {
      const result = await dependencies.queues.consumeRateLimit(
        scope,
        opaqueSubject(subject(request, response)),
        limit,
        60,
      );
      response.setHeader("X-RateLimit-Limit", String(limit));
      response.setHeader("X-RateLimit-Remaining", String(result.remaining));
      if (!result.allowed) {
        response.setHeader("Retry-After", String(result.retryAfterSeconds));
        throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.");
      }
    });

  app.use(
    "/api/v1",
    rateLimit(
      "api",
      config.RATE_LIMIT_API_REQUESTS_PER_MINUTE,
      (request) => request.ip ?? "unknown",
    ),
  );

  const authenticate = asyncMiddleware(async (request, response) => {
    const cookies = parseCookie(request.header("cookie") ?? "");
    const token = cookies[config.ACCESS_COOKIE_NAME];
    if (!token) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    response.locals.auth = await dependencies.authService.authenticate(token);
  });

  const requireCsrf = asyncMiddleware(async (request, response) => {
    const context = auth(response);
    const token = request.header("X-CSRF-Token") ?? "";
    if (!dependencies.authService.verifyCsrf(context.sessionId, token))
      throw new AppError(400, "CSRF_INVALID", "The CSRF token is invalid.");
  });

  app.post(
    "/api/v1/auth/register",
    rateLimit(
      "auth",
      config.RATE_LIMIT_AUTH_ATTEMPTS_PER_MINUTE,
      (request) => `${request.ip ?? "unknown"}:register`,
    ),
    asyncRoute(async (request, response) => {
      const input = registerRequestSchema.parse(request.body);
      const result = await dependencies.authService.register(
        input,
        request.header("user-agent") ?? "unknown",
        clientIpPrefix(request),
      );
      setAuthCookies(response, config, result);
      response.status(201).json(
        dataEnvelope({
          user: result.user,
          workspace: result.workspaces[0],
          csrfToken: result.csrfToken,
        }),
      );
    }),
  );

  app.post(
    "/api/v1/auth/login",
    rateLimit(
      "auth",
      config.RATE_LIMIT_AUTH_ATTEMPTS_PER_MINUTE,
      (request) => `${request.ip ?? "unknown"}:login`,
    ),
    asyncRoute(async (request, response) => {
      const input = loginRequestSchema.parse(request.body);
      const result = await dependencies.authService.login(
        input,
        request.header("user-agent") ?? "unknown",
        clientIpPrefix(request),
      );
      setAuthCookies(response, config, result);
      response.json(
        dataEnvelope({
          user: result.user,
          workspaces: result.workspaces,
          csrfToken: result.csrfToken,
        }),
      );
    }),
  );

  app.post(
    "/api/v1/auth/refresh",
    asyncRoute(async (request, response) => {
      const cookies = parseCookie(request.header("cookie") ?? "");
      const token = cookies[config.REFRESH_COOKIE_NAME];
      if (!token) throw new AppError(401, "INVALID_SESSION", "The session is invalid.");
      const result = await dependencies.authService.refresh(
        token,
        request.header("user-agent") ?? "unknown",
        clientIpPrefix(request),
      );
      setAuthCookies(response, config, result);
      response.json(
        dataEnvelope({ csrfToken: result.csrfToken, accessExpiresAt: result.accessExpiresAt }),
      );
    }),
  );

  app.post(
    "/api/v1/auth/logout",
    authenticate,
    requireCsrf,
    asyncRoute(async (_request, response) => {
      await dependencies.authService.logout(auth(response).sessionId);
      response.append(
        "Set-Cookie",
        stringifySetCookie({
          name: config.ACCESS_COOKIE_NAME,
          value: "",
          path: "/",
          expires: new Date(0),
          httpOnly: true,
        }),
      );
      response.append(
        "Set-Cookie",
        stringifySetCookie({
          name: config.REFRESH_COOKIE_NAME,
          value: "",
          path: "/",
          expires: new Date(0),
          httpOnly: true,
        }),
      );
      response.status(204).end();
    }),
  );

  app.get(
    "/api/v1/auth/me",
    authenticate,
    asyncRoute(async (_request, response) => {
      const context = auth(response);
      response.json(
        dataEnvelope({
          ...(await dependencies.authService.getProfile(context.userId)),
          csrfToken: dependencies.authService.csrfToken(context.sessionId),
        }),
      );
    }),
  );

  app.post(
    "/api/v1/uploads/intents",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const result = await dependencies.resourceService.createUploadIntent(
        createUploadIntentRequestSchema.parse(request.body),
        auth(response).userId,
      );
      response.status(201).json(dataEnvelope(result));
    }),
  );

  app.post(
    "/api/v1/uploads/:uploadIntentId/complete",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const uploadIntentId = objectIdSchema.parse(request.params.uploadIntentId);
      const input = completeUploadRequestSchema.parse(request.body);
      const result = await dependencies.resourceService.completeUpload(
        uploadIntentId,
        input.workspaceId,
        auth(response).userId,
        requestId(response),
      );
      response.status(201).json(dataEnvelope(result));
    }),
  );

  app.get(
    "/api/v1/documents",
    authenticate,
    asyncRoute(async (request, response) => {
      const input = z
        .strictObject({
          workspaceId: objectIdSchema,
          query: z.string().trim().max(120).optional(),
        })
        .parse(request.query);
      response.json(
        dataEnvelope(
          await dependencies.resourceService.listDocuments(
            input.workspaceId,
            auth(response).userId,
            input.query,
          ),
        ),
      );
    }),
  );

  app.get(
    "/api/v1/documents/:documentId",
    authenticate,
    asyncRoute(async (request, response) => {
      response.json(
        dataEnvelope(
          await dependencies.resourceService.getDocument(
            objectIdSchema.parse(request.params.documentId),
            auth(response).userId,
          ),
        ),
      );
    }),
  );

  app.patch(
    "/api/v1/documents/:documentId",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const input = updateDocumentRequestSchema.parse(request.body);
      response.json(
        dataEnvelope({
          document: await dependencies.resourceService.updateDocument(
            objectIdSchema.parse(request.params.documentId),
            auth(response).userId,
            input.displayName,
          ),
        }),
      );
    }),
  );

  app.delete(
    "/api/v1/documents/:documentId",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      await dependencies.resourceService.deleteDocument(
        objectIdSchema.parse(request.params.documentId),
        auth(response).userId,
        requestId(response),
      );
      response.status(202).json(dataEnvelope({ deletionScheduled: true }));
    }),
  );

  app.post(
    "/api/v1/documents/:documentId/reprocess",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      reprocessDocumentRequestSchema.parse(request.body);
      const result = await dependencies.resourceService.reprocessDocument(
        objectIdSchema.parse(request.params.documentId),
        auth(response).userId,
        requestId(response),
      );
      response.status(202).json(dataEnvelope(result));
    }),
  );

  app.post(
    "/api/v1/documents/:documentId/cancel",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const input = cancelDocumentRequestSchema.parse(request.body);
      const result = await dependencies.resourceService.cancelDocument(
        objectIdSchema.parse(request.params.documentId),
        auth(response).userId,
        input.processingVersion,
      );
      response.status(202).json(dataEnvelope(result));
    }),
  );

  app.get(
    "/api/v1/documents/:documentId/view-url",
    authenticate,
    asyncRoute(async (request, response) => {
      const page =
        request.query.page === undefined
          ? undefined
          : z.coerce.number().int().positive().parse(request.query.page);
      response.json(
        dataEnvelope(
          await dependencies.resourceService.createViewUrl(
            objectIdSchema.parse(request.params.documentId),
            auth(response).userId,
            page,
          ),
        ),
      );
    }),
  );

  app.get(
    "/api/v1/documents/:documentId/progress",
    authenticate,
    asyncRoute(async (request, response) => {
      const documentId = objectIdSchema.parse(request.params.documentId);
      const snapshot = await dependencies.resourceService.getDocument(
        documentId,
        auth(response).userId,
      );
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders();
      response.write(`event: document.snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      const subscriber = createRedisConnection(config.REDIS_URL);
      const channel = `${config.REDIS_KEY_PREFIX}:document:${documentId}:progress`;
      await subscriber.subscribe(channel);
      const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15000);
      subscriber.on("message", (_channel, payload) => {
        const parsed = progressEventSchema.safeParse(JSON.parse(payload) as unknown);
        if (parsed.success)
          response.write(
            `id: ${parsed.data.processingVersion}:${parsed.data.stageSequence}\nevent: document.progress\ndata: ${JSON.stringify(parsed.data)}\n\n`,
          );
      });
      request.on("close", () => {
        clearInterval(heartbeat);
        void subscriber.unsubscribe(channel).finally(() => subscriber.disconnect());
      });
    }),
  );

  app.post(
    "/api/v1/document-collections",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const input = createCollectionRequestSchema.parse(request.body);
      response.status(201).json(
        dataEnvelope({
          collection: await dependencies.resourceService.createCollection(
            input,
            auth(response).userId,
          ),
        }),
      );
    }),
  );

  app.get(
    "/api/v1/document-collections",
    authenticate,
    asyncRoute(async (request, response) => {
      const workspaceId = objectIdSchema.parse(request.query.workspaceId);
      response.json(
        dataEnvelope(
          await dependencies.resourceService.listCollections(workspaceId, auth(response).userId),
        ),
      );
    }),
  );

  app.patch(
    "/api/v1/document-collections/:collectionId",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const collection = await dependencies.resourceService.updateCollection(
        objectIdSchema.parse(request.params.collectionId),
        auth(response).userId,
        updateCollectionRequestSchema.parse(request.body),
      );
      response.json(dataEnvelope({ collection }));
    }),
  );

  app.delete(
    "/api/v1/document-collections/:collectionId",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      await dependencies.resourceService.deleteCollection(
        objectIdSchema.parse(request.params.collectionId),
        auth(response).userId,
      );
      response.status(204).end();
    }),
  );

  app.post(
    "/api/v1/conversations",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const input = createConversationRequestSchema.parse(request.body);
      response.status(201).json(
        dataEnvelope({
          conversation: await dependencies.resourceService.createConversation(
            input,
            auth(response).userId,
          ),
        }),
      );
    }),
  );

  app.get(
    "/api/v1/conversations",
    authenticate,
    asyncRoute(async (request, response) => {
      const workspaceId = objectIdSchema.parse(request.query.workspaceId);
      response.json(
        dataEnvelope(
          await dependencies.resourceService.listConversations(workspaceId, auth(response).userId),
        ),
      );
    }),
  );

  app.get(
    "/api/v1/conversations/:conversationId",
    authenticate,
    asyncRoute(async (request, response) => {
      response.json(
        dataEnvelope(
          await dependencies.resourceService.getConversation(
            objectIdSchema.parse(request.params.conversationId),
            auth(response).userId,
          ),
        ),
      );
    }),
  );

  app.patch(
    "/api/v1/conversations/:conversationId",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      const conversation = await dependencies.resourceService.updateConversation(
        objectIdSchema.parse(request.params.conversationId),
        auth(response).userId,
        updateConversationRequestSchema.parse(request.body),
      );
      response.json(dataEnvelope({ conversation }));
    }),
  );

  app.delete(
    "/api/v1/conversations/:conversationId",
    authenticate,
    requireCsrf,
    asyncRoute(async (request, response) => {
      await dependencies.resourceService.deleteConversation(
        objectIdSchema.parse(request.params.conversationId),
        auth(response).userId,
      );
      response.status(204).end();
    }),
  );

  app.get(
    "/api/v1/citations/:citationId/source",
    authenticate,
    asyncRoute(async (request, response) => {
      response.json(
        dataEnvelope(
          await dependencies.resourceService.getCitationSource(
            objectIdSchema.parse(request.params.citationId),
            auth(response).userId,
          ),
        ),
      );
    }),
  );

  app.post(
    "/api/v1/conversations/:conversationId/questions",
    authenticate,
    requireCsrf,
    rateLimit(
      "generation",
      config.RATE_LIMIT_GENERATION_REQUESTS_PER_MINUTE,
      (_request, response) => auth(response).userId,
    ),
    asyncRoute(async (request, response) => {
      const conversationId = objectIdSchema.parse(request.params.conversationId);
      const input = askQuestionRequestSchema.parse(request.body);
      const wantsStream =
        request.accepts(["text/event-stream", "application/json"]) === "text/event-stream";
      if (wantsStream) {
        response.status(200);
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.flushHeaders();
        response.write(
          `event: answer.accepted\ndata: ${JSON.stringify({ requestId: requestId(response) })}\n\n`,
        );
        response.write(`event: answer.stage\ndata: ${JSON.stringify({ stage: "retrieving" })}\n\n`);
        const result = await dependencies.resourceService.askQuestion(
          conversationId,
          auth(response).userId,
          input.question,
          input.clientRequestId,
        );
        response.write(`event: answer.complete\ndata: ${JSON.stringify(result)}\n\n`);
        response.end();
        return;
      }
      const result = await dependencies.resourceService.askQuestion(
        conversationId,
        auth(response).userId,
        input.question,
        input.clientRequestId,
      );
      response.status(201).json(dataEnvelope(result));
    }),
  );

  app.use((_request, _response, next) =>
    next(new AppError(404, "DOCUMENT_NOT_FOUND", "The requested route was not found.")),
  );
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalized =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? new AppError(
              400,
              "VALIDATION_ERROR",
              "The request is invalid.",
              error.issues.map((issue) => ({ path: issue.path.join("."), issue: issue.code })),
            )
          : new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
    if (normalized.status >= 500)
      dependencies.logger.error({ err: error, requestId: requestId(response) }, "request failed");
    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        requestId: requestId(response),
        ...(normalized.details ? { details: normalized.details } : {}),
      },
    });
  });
  return app;
}
