# AskPDF

AskPDF is a citation-first retrieval-augmented generation application. A signed-in user uploads a PDF directly to S3-compatible storage, a BullMQ worker extracts and embeds it asynchronously, and the API answers questions only from authorized document versions with page-level evidence.

The repository follows the supplied architecture: strict TypeScript, `pnpm` workspaces, React/Vite/TanStack Query, Express/Zod, MongoDB/Mongoose, Redis/BullMQ, Gemini, `pdfjs-dist`, MinIO-compatible object storage, SSE, Pino, Vitest, Supertest, and Playwright.

## 1. Complete directory tree and environment setup

```text
askPDF/
├── .github/workflows/ci.yml
├── apps/
│   ├── api/
│   │   ├── src/application/{auth-service,errors,resource-service}.ts
│   │   ├── src/{app,server}.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/
│   │   ├── src/pages/{auth-page,chat-page,documents-page}.tsx
│   │   ├── src/{api,app,main,session}.tsx
│   │   ├── src/styles.css
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── worker/
│       ├── src/worker.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── ai/src/index.ts
│   ├── config/src/index.ts
│   ├── contracts/src/index.ts
│   ├── database/src/{connection,index}.ts
│   ├── database/src/models/index.ts
│   ├── observability/src/index.ts
│   ├── queue/src/index.ts
│   ├── rag/src/index.ts
│   └── storage/src/index.ts
├── tests/e2e/auth.spec.ts
├── scripts/docker/mongo-init.js
├── docs/
│   ├── 00-project-understanding.md
│   ├── 01-requirements-traceability.md
│   ├── 02-architecture-and-dependency-map.md
│   ├── 03-implementation-roadmap.md
│   ├── 04-test-security-and-release-plan.md
│   ├── 05-v2-learning-features.md
│   ├── 06-codex-antigravity-execution-pipeline.md
│   ├── decisions/ADR-0001-implementation-baseline.md
│   ├── adr/ADR-0002-phone-or-email-authentication.md
│   └── design/*.png
├── .env.example
├── docker-compose.yml
├── IMPLEMENTATION_BACKLOG.md
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.workspace.ts
```

Prerequisites:

- Node.js 24.18.x and Corepack-enabled pnpm 11.9.x
- Docker Desktop with Compose v2
- A Gemini API key for production embedding and answer generation; local development has a citation-safe fallback
- MongoDB Atlas with Vector Search and Search indexes for production retrieval

Setup:

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
Copy-Item .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm dev
```

Local addresses are `http://localhost:5174` for the web app, `http://localhost:4000` for the API, `localhost:27018` for MongoDB, `localhost:6379` for Redis, and `http://localhost:9002` for the MinIO console. MongoDB uses host port 27018 intentionally to avoid the machine's existing service on 27017. The web app uses 5174 because 5173 is occupied on this machine.

All supported configuration keys and proposed local defaults are defined in [`.env.example`](./.env.example). Copy it to the ignored `.env` file and replace the generated-development secrets before any shared or deployed environment. When `GEMINI_API_KEY` is empty in development and `AI_LOCAL_FALLBACK=true`, AskPDF uses deterministic local embeddings and citation-safe extractive answers. Supplying a key automatically selects Gemini. Production always requires the key and fails configuration validation without it.

The Compose file creates a single-node MongoDB replica set, an authenticated Redis instance, a private MinIO bucket, persistent named volumes, health checks, and idempotent initialization jobs. It does not run the application processes; `pnpm dev` keeps web/API/worker logs visible during development.

## 2. Core architecture interfaces and schemas

The canonical Zod boundary contracts live in [`packages/contracts/src/index.ts`](./packages/contracts/src/index.ts). They cover registration and login, upload intent/completion, document changes, processing jobs, collections, conversations, questions, progress events, citations, and model-generated answer claims.

The canonical Mongoose records live in [`packages/database/src/models/index.ts`](./packages/database/src/models/index.ts):

- `User`, `Workspace`, `WorkspaceMember`, and `AuthSession` enforce identity, tenant membership, opaque refresh-token rotation, and role ownership.
- `UploadIntent`, `Document`, and `ProcessingRun` separate upload state from immutable processing versions and resumable job state.
- `DocumentChunk` stores deterministic chunk identity, page spans, lexical text, embeddings, and embedding version.
- `DocumentCollection`, `Conversation`, `Message`, and `Citation` preserve selected source scope and evidence lineage.
- `AuditEvent` records security-relevant actions without storing secrets.

The API is rooted at `/api/v1` and provides:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `POST /uploads/intents`, `POST /uploads/:uploadIntentId/complete`
- `GET /documents`, `GET/PATCH/DELETE /documents/:documentId`
- `POST /documents/:documentId/reprocess`, `POST /documents/:documentId/cancel`
- `GET /documents/:documentId/view-url`, `GET /documents/:documentId/progress`
- `POST/GET /document-collections`, `PATCH/DELETE /document-collections/:collectionId`
- `POST/GET /conversations`, `GET/PATCH /conversations/:conversationId`
- `POST /conversations/:conversationId/questions` with JSON or SSE response negotiation
- `GET /citations/:citationId/source`

External writes are validated with strict Zod objects. Every resource service query resolves workspace membership before access, and retrieval filters include workspace ID, selected document IDs, active processing version, and deletion state. The API never parses PDFs or calculates embeddings.

Queue ownership is centralized in [`packages/queue/src/index.ts`](./packages/queue/src/index.ts). Job IDs are deterministic (`documentId-processingVersion`), retries use exponential backoff, and completed/failed retention is bounded. The worker validates payloads again, checkpoints ordered stages, checks cancellation and processing version before mutations, streams downloads through a byte guard, verifies SHA-256, cleans temporary directories, batches embeddings, and writes chunks idempotently.

The RAG primitives in [`packages/rag/src/index.ts`](./packages/rag/src/index.ts) perform PDF signature validation, page-aware extraction, Unicode normalization, deterministic overlapping chunks, reciprocal-rank fusion, and exact normalized citation-excerpt validation. [`packages/ai/src/index.ts`](./packages/ai/src/index.ts) constrains Gemini to structured, cited claims and validates the model response before it is accepted.

Authentication accepts exactly one of email or E.164 phone number plus a 12–128 character password. Passwords use Argon2id, access tokens are short-lived HTTP-only cookies, refresh tokens are opaque, peppered, rotated, and reuse-detected, and unsafe authenticated requests require a session-bound CSRF token. Email/SMS verification is intentionally out of scope per the latest user instruction.

## 3. Detailed implementation guide

The Word guide in `docs/AskPDF_Implementation_and_Code_Guide.docx` explains the repository in build order, maps each important code block to its concept and visible behavior, and includes the 14-day Codex/AntiGravity execution pipeline. The Markdown companion is [`docs/06-codex-antigravity-execution-pipeline.md`](./docs/06-codex-antigravity-execution-pipeline.md).

The optional quiz, notes, debate, flashcard, comparison, and learning-progress features remain version-two scope and are fully designed in [`docs/05-v2-learning-features.md`](./docs/05-v2-learning-features.md); they are not silently enabled in the MVP.

## 4. Master workflow cheat sheet

From a clean checkout:

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
Copy-Item .env.example .env
# For production, set GEMINI_API_KEY plus non-development secrets.
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit
docker compose up -d --wait
pnpm dev
```

Validation and build:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```

Useful operations:

```powershell
docker compose ps
docker compose logs --tail=100 mongo redis minio
Invoke-RestMethod http://localhost:4000/health/live
Invoke-RestMethod http://localhost:4000/health/ready
docker compose stop
docker compose start
docker compose down
```

`docker compose down` preserves named volumes. Use `docker compose down -v` only when intentionally deleting local MongoDB, Redis, and MinIO data.

Production setup requires replacing all local secrets, using managed MongoDB/Redis/object storage endpoints, creating the documented Atlas Search indexes, enabling TLS and secure cookies, applying provider/workspace quotas, and passing every quality and release gate in [`docs/04-test-security-and-release-plan.md`](./docs/04-test-security-and-release-plan.md).
