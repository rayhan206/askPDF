# Ask PDF Codex and AntiGravity Execution Pipeline

This document converts the specified Ask-PDF architecture into a deterministic fourteen-day implementation sequence for an AI coding environment. It is an implementation specification, not authorization to create application code. Begin Day 1 only after `APPROVE PLAN` or the corresponding phase approval. The baseline uses Node.js 24 LTS and exact dependency versions verified on 2026-09-04; the generated `pnpm-lock.yaml` becomes authoritative after the first approved installation.

Version verification sources: [Node.js releases](https://nodejs.org/en/about/previous-releases), [npm registry](https://www.npmjs.com/), and official container registries. The local authenticated replica set follows MongoDB's [development and testing replica-set guidance](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-for-testing/); it is not a production topology.

# 1. COMPLETE DIRECTORY TREE & ENVIRONMENT SETUP

## Repository tree

```text
ask-pdf/
├── .env.example
├── .dockerignore
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── staging.yml
├── .gitignore
├── .npmrc
├── .nvmrc
├── AGENTS.md
├── IMPLEMENTATION_BACKLOG.md
├── README.md
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
├── Dockerfile.worker
├── eslint.config.js
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prettier.config.js
├── tsconfig.base.json
├── tsconfig.json
├── vitest.atlas.config.ts
├── vitest.integration.config.ts
├── vitest.rag.config.ts
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── application/
│   │       │   ├── auth-service.ts
│   │       │   ├── authorization-service.ts
│   │       │   ├── collection-service.ts
│   │       │   ├── conversation-service.ts
│   │       │   ├── document-service.ts
│   │       │   ├── question-service.ts
│   │       │   └── upload-service.ts
│   │       ├── middleware/
│   │       │   ├── authenticate.ts
│   │       │   ├── csrf.ts
│   │       │   ├── error-handler.ts
│   │       │   ├── rate-limit.ts
│   │       │   ├── request-context.ts
│   │       │   └── require-workspace-role.ts
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   └── v1/
│   │       │       ├── auth.ts
│   │       │       ├── citations.ts
│   │       │       ├── collections.ts
│   │       │       ├── conversations.ts
│   │       │       ├── document-events.ts
│   │       │       ├── documents.ts
│   │       │       ├── question-stream.ts
│   │       │       └── uploads.ts
│   │       ├── app.ts
│   │       ├── server.ts
│   │       └── shutdown.ts
│   ├── web/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── app.tsx
│   │       │   ├── providers.tsx
│   │       │   ├── query-client.ts
│   │       │   └── router.tsx
│   │       ├── components/
│   │       │   ├── app-shell.tsx
│   │       │   ├── error-panel.tsx
│   │       │   ├── loading-skeleton.tsx
│   │       │   └── toast-region.tsx
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── citations/
│   │       │   ├── collections/
│   │       │   ├── conversations/
│   │       │   └── documents/
│   │       ├── hooks/
│   │       │   ├── use-answer-stream.ts
│   │       │   └── use-job-progress.ts
│   │       ├── lib/
│   │       │   ├── api-client.ts
│   │       │   ├── safe-markdown.tsx
│   │       │   └── upload-client.ts
│   │       ├── routes/
│   │       │   ├── collection-detail-page.tsx
│   │       │   ├── collections-page.tsx
│   │       │   ├── conversation-page.tsx
│   │       │   ├── conversations-page.tsx
│   │       │   ├── document-detail-page.tsx
│   │       │   ├── documents-page.tsx
│   │       │   ├── landing-page.tsx
│   │       │   ├── login-page.tsx
│   │       │   ├── new-conversation-page.tsx
│   │       │   ├── not-found-page.tsx
│   │       │   └── register-page.tsx
│   │       ├── index.css
│   │       └── main.tsx
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── processors/
│           │   ├── delete-document-processor.ts
│           │   └── ingest-document-processor.ts
│           ├── stages/
│           │   ├── chunk-stage.ts
│           │   ├── cleanup-stage.ts
│           │   ├── download-stage.ts
│           │   ├── embed-stage.ts
│           │   ├── extract-stage.ts
│           │   ├── index-stage.ts
│           │   ├── normalize-stage.ts
│           │   └── validate-stage.ts
│           ├── shutdown.ts
│           └── worker.ts
├── packages/
│   ├── ai/
│   │   ├── package.json
│   │   └── src/
│   │       ├── embeddings/embedding-provider.ts
│   │       ├── generation/generation-provider.ts
│   │       ├── providers/gemini-embedding-provider.ts
│   │       ├── providers/gemini-generation-provider.ts
│   │       └── index.ts
│   ├── config/
│   │   ├── package.json
│   │   └── src/{api-environment.ts,index.ts,shared.ts,web-environment.ts,worker-environment.ts}
│   ├── contracts/
│   │   ├── package.json
│   │   └── src/{api.ts,common.ts,domain.ts,index.ts,jobs.ts,sse.ts}
│   ├── database/
│   │   ├── package.json
│   │   └── src/
│   │       ├── indexes/{atlas-lexical-v1.json,atlas-vector-v1.json}
│   │       ├── models/{audit-event.ts,auth-session.ts,citation.ts,conversation.ts,document-chunk.ts,document-collection.ts,document-processing-run.ts,document.ts,message.ts,upload-intent.ts,user.ts,workspace-member.ts,workspace.ts}
│   │       ├── repositories/{auth-session-repository.ts,collection-repository.ts,conversation-repository.ts,document-repository.ts,upload-intent-repository.ts,workspace-repository.ts}
│   │       ├── connection.ts
│   │       ├── index.ts
│   │       └── model-types.ts
│   ├── observability/
│   │   ├── package.json
│   │   └── src/{context.ts,index.ts,logger.ts,metrics.ts}
│   ├── queue/
│   │   ├── package.json
│   │   └── src/{factories.ts,index.ts,names.ts,progress-store.ts,retry-policy.ts}
│   ├── rag/
│   │   ├── package.json
│   │   └── src/
│   │       ├── chunking/{chunk-id.ts,chunker.ts,tokenizer.ts}
│   │       ├── citations/{citation-validator.ts,claim-coverage.ts}
│   │       ├── evaluation/{dataset-schema.ts,evaluator.ts,metrics.ts}
│   │       ├── ingestion/{page-extractor.ts,pdf-validator.ts,scanned-page-detector.ts}
│   │       ├── normalization/{line-join.ts,normalize-page.ts,repeated-furniture.ts}
│   │       ├── prompts/{answer-prompt.ts,answer-schema.ts}
│   │       ├── ranking/{context-budget.ts,deduplicate.ts,reciprocal-rank-fusion.ts,rerank.ts}
│   │       ├── retrieval/{hybrid-retriever.ts,lexical-retriever.ts,vector-retriever.ts}
│   │       └── index.ts
│   ├── storage/
│   │   ├── package.json
│   │   └── src/{index.ts,s3-storage-adapter.ts,storage-adapter.ts}
│   └── test-utils/
│       ├── package.json
│       └── src/{factories.ts,fixtures.ts,index.ts,test-containers.ts}
├── scripts/
│   ├── docker/mongo-init.js
│   ├── evaluation/run.ts
│   ├── indexes/sync-local-indexes.ts
│   ├── indexes/validate-atlas-indexes.ts
│   ├── indexes/validate-local-indexes.ts
│   ├── smoke/staging.ps1
│   └── verify/no-secret-client-bundle.ts
├── tests/
│   ├── e2e/{ask-document.spec.ts,auth.spec.ts,citation-navigation.spec.ts,upload-progress.spec.ts}
│   ├── fixtures/pdfs/
│   ├── integration/{auth.integration.test.ts,document-ingestion.integration.test.ts,questions.integration.test.ts,tenant-isolation.integration.test.ts}
│   ├── load/{large-file.load.test.ts,query-load.test.ts}
│   ├── rag-evaluation/{dataset.json,results/.gitkeep,retrieval-evaluation.test.ts}
│   └── security/{malicious-pdf.test.ts,prompt-injection.test.ts,tenant-matrix.test.ts}
└── docs/
    ├── 00-project-understanding.md
    ├── 01-requirements-traceability.md
    ├── 02-architecture-and-dependency-map.md
    ├── 03-implementation-roadmap.md
    ├── 04-test-security-and-release-plan.md
    ├── 05-v2-learning-features.md
    ├── 06-codex-antigravity-execution-pipeline.md
    ├── decisions/ADR-0001-implementation-baseline.md
    ├── api/
    ├── operations/
    ├── runbooks/{backup-restore.md,dead-letter-replay.md,deployment.md,index-changes.md,rollback.md}
    └── threat-model/
```

Brace notation in the tree is a compact listing convention; every named file is a separate file.

## Runtime and workspace configuration

### `.nvmrc`

```text
24.20.0
```

### `.npmrc`

```ini
engine-strict=true
save-exact=true
strict-peer-dependencies=true
prefer-frozen-lockfile=true
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
```

### Root `package.json`

```json
{
  "name": "ask-pdf",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.25.0",
  "engines": {
    "node": ">=24.20.0 <25",
    "pnpm": ">=11.25.0 <12"
  },
  "scripts": {
    "build": "pnpm -r --if-present build",
    "clean": "pnpm -r --if-present clean",
    "dev": "pnpm --parallel --filter @askpdf/web --filter @askpdf/api --filter @askpdf/worker dev",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f mongo redis minio",
    "docker:up": "docker compose up -d --wait",
    "db:indexes:sync:local": "node --env-file=.env --import tsx scripts/indexes/sync-local-indexes.ts",
    "db:indexes:validate": "node --env-file=.env --import tsx scripts/indexes/validate-local-indexes.ts",
    "db:indexes:validate:atlas": "node --env-file=.env --import tsx scripts/indexes/validate-atlas-indexes.ts",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "lint": "pnpm -r --if-present lint",
    "test:e2e": "playwright test",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:atlas": "vitest run --config vitest.atlas.config.ts",
    "test:evaluation": "vitest run --config vitest.rag.config.ts",
    "test:evaluation:atlas": "vitest run --config vitest.atlas.config.ts tests/rag-evaluation",
    "test:load": "vitest run tests/load",
    "test:security": "vitest run tests/security",
    "test:unit": "pnpm -r --if-present test:unit",
    "typecheck": "pnpm -r --if-present typecheck",
    "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm test:security && pnpm test:evaluation && pnpm build && pnpm verify:client-secrets",
    "verify:client-secrets": "node --import tsx scripts/verify/no-secret-client-bundle.ts",
    "prepare": "husky"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.62.1",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/cors": "2.8.19",
    "@types/express": "5.0.6",
    "@types/node": "24.13.3",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "@types/supertest": "7.2.1",
    "@vitest/coverage-v8": "5.0.0",
    "eslint": "10.9.1",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.6",
    "husky": "9.1.7",
    "jsdom": "30.0.1",
    "lint-staged": "17.4.1",
    "prettier": "3.9.6",
    "tsx": "4.23.13",
    "typescript": "7.0.2",
    "typescript-eslint": "8.69.0",
    "vitest": "5.0.0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --max-warnings=0", "prettier --write"],
    "*.{json,md,yaml,yml,css}": ["prettier --write"]
  }
}
```

## Application package manifests

### `apps/web/package.json`

```json
{
  "name": "@askpdf/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b && vite build --envDir ../..",
    "dev": "vite --envDir ../..",
    "lint": "eslint src vite.config.ts --max-warnings=0",
    "test:unit": "vitest run --environment jsdom",
    "typecheck": "tsc -b --pretty false"
  },
  "dependencies": {
    "@askpdf/contracts": "workspace:*",
    "@tanstack/react-query": "5.102.8",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "lucide-react": "1.40.0",
    "pdfjs-dist": "6.3.289",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-dropzone": "20.1.1",
    "react-markdown": "10.1.0",
    "react-router-dom": "7.18.3",
    "rehype-sanitize": "6.0.0",
    "remark-gfm": "4.0.1",
    "tailwind-merge": "3.6.0",
    "zod": "4.5.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.3.3",
    "@vitejs/plugin-react": "6.1.1",
    "tailwindcss": "4.3.3",
    "vite": "8.2.2"
  }
}
```

### `apps/api/package.json`

```json
{
  "name": "@askpdf/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "dev": "node --watch --env-file=../../.env --import tsx src/server.ts",
    "lint": "eslint src --max-warnings=0",
    "start": "node --env-file=../../.env dist/server.js",
    "test:unit": "vitest run",
    "typecheck": "tsc -b --pretty false"
  },
  "dependencies": {
    "@askpdf/ai": "workspace:*",
    "@askpdf/config": "workspace:*",
    "@askpdf/contracts": "workspace:*",
    "@askpdf/database": "workspace:*",
    "@askpdf/observability": "workspace:*",
    "@askpdf/queue": "workspace:*",
    "@askpdf/rag": "workspace:*",
    "@askpdf/storage": "workspace:*",
    "argon2": "0.45.1",
    "cookie": "2.0.1",
    "cors": "2.8.6",
    "express": "5.2.1",
    "helmet": "8.3.0",
    "jose": "6.2.10",
    "rate-limiter-flexible": "11.2.0",
    "zod": "4.5.4"
  }
}
```

### `apps/worker/package.json`

```json
{
  "name": "@askpdf/worker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "dev": "node --watch --env-file=../../.env --import tsx src/worker.ts",
    "lint": "eslint src --max-warnings=0",
    "start": "node --env-file=../../.env dist/worker.js",
    "test:unit": "vitest run",
    "typecheck": "tsc -b --pretty false"
  },
  "dependencies": {
    "@askpdf/ai": "workspace:*",
    "@askpdf/config": "workspace:*",
    "@askpdf/contracts": "workspace:*",
    "@askpdf/database": "workspace:*",
    "@askpdf/observability": "workspace:*",
    "@askpdf/queue": "workspace:*",
    "@askpdf/rag": "workspace:*",
    "@askpdf/storage": "workspace:*"
  }
}
```

## Shared package manifests

Each shared package uses the same scripts below, with its listed dependencies. The JSON objects are complete manifests and can be written directly to the named files.

```json
[
  {
    "file": "packages/contracts/package.json",
    "manifest": {
      "name": "@askpdf/contracts",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": { "zod": "4.5.4" }
    }
  },
  {
    "file": "packages/config/package.json",
    "manifest": {
      "name": "@askpdf/config",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": { "zod": "4.5.4" }
    }
  },
  {
    "file": "packages/database/package.json",
    "manifest": {
      "name": "@askpdf/database",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "indexes:sync:local": "node --env-file=../../.env --import tsx ../../scripts/indexes/sync-local-indexes.ts",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": { "@askpdf/contracts": "workspace:*", "mongoose": "9.9.4", "zod": "4.5.4" }
    }
  },
  {
    "file": "packages/storage/package.json",
    "manifest": {
      "name": "@askpdf/storage",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": {
        "@aws-sdk/client-s3": "3.1126.0",
        "@aws-sdk/s3-request-presigner": "3.1126.0",
        "file-type": "22.0.2",
        "zod": "4.5.4"
      }
    }
  },
  {
    "file": "packages/queue/package.json",
    "manifest": {
      "name": "@askpdf/queue",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": {
        "@askpdf/contracts": "workspace:*",
        "bullmq": "6.3.4",
        "ioredis": "6.0.0",
        "zod": "4.5.4"
      }
    }
  },
  {
    "file": "packages/ai/package.json",
    "manifest": {
      "name": "@askpdf/ai",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": { "@google/genai": "2.21.0", "zod": "4.5.4" }
    }
  },
  {
    "file": "packages/rag/package.json",
    "manifest": {
      "name": "@askpdf/rag",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": {
        "@askpdf/ai": "workspace:*",
        "@askpdf/contracts": "workspace:*",
        "@askpdf/database": "workspace:*",
        "pdfjs-dist": "6.3.289",
        "zod": "4.5.4"
      }
    }
  },
  {
    "file": "packages/observability/package.json",
    "manifest": {
      "name": "@askpdf/observability",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": {
        "@sentry/node": "10.73.0",
        "pino": "10.3.1",
        "pino-http": "11.0.0",
        "prom-client": "15.1.3",
        "zod": "4.5.4"
      }
    }
  },
  {
    "file": "packages/test-utils/package.json",
    "manifest": {
      "name": "@askpdf/test-utils",
      "version": "1.0.0",
      "private": true,
      "type": "module",
      "exports": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc -b",
        "lint": "eslint src --max-warnings=0",
        "test:unit": "vitest run",
        "typecheck": "tsc -b --pretty false"
      },
      "dependencies": {
        "@askpdf/contracts": "workspace:*",
        "supertest": "7.2.2",
        "testcontainers": "12.1.0",
        "zod": "4.5.4"
      }
    }
  }
]
```

## Complete `.env.example`

```dotenv
# Shared runtime identity
NODE_ENV=development
APP_NAME=askpdf
APP_VERSION=1.0.0
DEPLOYMENT_ENV=local
LOG_LEVEL=debug
LOG_PRETTY=true

# Public web configuration
WEB_PORT=5173
VITE_APP_NAME=Ask-PDF
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_SSE_BASE_URL=http://localhost:4000/api/v1
VITE_MAX_UPLOAD_BYTES=104857600
VITE_MAX_SELECTED_DOCUMENTS=20
VITE_ENABLE_OCR_STATUS=false

# API and browser security
API_HOST=0.0.0.0
API_PORT=4000
API_PUBLIC_URL=http://localhost:4000
WEB_ORIGIN=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=false
JSON_BODY_LIMIT_BYTES=1048576
REQUEST_TIMEOUT_MS=30000
SHUTDOWN_TIMEOUT_MS=30000

# MongoDB
MONGODB_URI=mongodb://askpdf_dev:askpdf_dev_password@localhost:27017/askpdf?authSource=admin&replicaSet=rs0&directConnection=true
MONGODB_DATABASE=askpdf
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=2
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
MONGODB_SOCKET_TIMEOUT_MS=30000
MONGODB_AUTO_INDEX=true
ATLAS_VECTOR_INDEX_NAME=document_chunks_vector_v1
ATLAS_LEXICAL_INDEX_NAME=document_chunks_lexical_v1

# Redis and BullMQ
REDIS_URL=redis://:askpdf_redis_password@localhost:6379/0
REDIS_KEY_PREFIX=askpdf:local
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_COMMAND_TIMEOUT_MS=5000
QUEUE_DOCUMENT_INGEST_NAME=documents.ingest.v1
QUEUE_DOCUMENT_DELETE_NAME=documents.delete.v1
QUEUE_DOCUMENT_DEAD_LETTER_NAME=documents.dead-letter.v1
JOB_ATTEMPTS=3
JOB_BACKOFF_BASE_MS=2000
JOB_REMOVE_ON_COMPLETE_COUNT=1000
JOB_REMOVE_ON_FAIL_COUNT=5000
WORKER_CONCURRENCY=2
WORKER_LOCK_DURATION_MS=120000
WORKER_STALLED_INTERVAL_MS=30000
PROGRESS_TTL_SECONDS=86400
ANSWER_CACHE_TTL_SECONDS=3600
QUERY_EMBEDDING_CACHE_TTL_SECONDS=86400
RATE_LIMIT_WINDOW_SECONDS=60

# S3 compatible private storage
STORAGE_PROVIDER=s3
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_BUCKET=askpdf-private
STORAGE_ACCESS_KEY_ID=askpdf_local_access
STORAGE_SECRET_ACCESS_KEY=askpdf_local_secret_change_before_deploy
STORAGE_FORCE_PATH_STYLE=true
STORAGE_UPLOAD_URL_TTL_SECONDS=900
STORAGE_READ_URL_TTL_SECONDS=600
STORAGE_CONNECT_TIMEOUT_MS=5000
STORAGE_REQUEST_TIMEOUT_MS=30000
STORAGE_MULTIPART_THRESHOLD_BYTES=16777216

# Authentication cookies CSRF and cursor signing
ACCESS_TOKEN_SECRET=development_only_access_secret_32_bytes_minimum_change_me
REFRESH_TOKEN_PEPPER=development_only_refresh_pepper_32_bytes_minimum_change_me
CSRF_SECRET=development_only_csrf_secret_32_bytes_minimum_change_me
CURSOR_SIGNING_SECRET=development_only_cursor_secret_32_bytes_minimum_change_me
JWT_ISSUER=askpdf-api
JWT_AUDIENCE=askpdf-web
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
ACCESS_COOKIE_NAME=askpdf_access
REFRESH_COOKIE_NAME=askpdf_refresh
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=
ARGON2_MEMORY_KIB=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1

# Gemini
GEMINI_API_KEY=development_only_gemini_key_not_valid
GEMINI_GENERATION_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSION=768
GEMINI_REQUEST_TIMEOUT_MS=30000
GEMINI_MAX_RETRIES=2
GEMINI_EMBEDDING_BATCH_SIZE=32
GEMINI_EMBEDDING_CONCURRENCY=2
GEMINI_GENERATION_TEMPERATURE=0.1
GEMINI_MAX_OUTPUT_TOKENS=2048

# Versioned RAG configuration
NORMALIZATION_VERSION=normalize-v1
CHUNKING_VERSION=chunk-v1
PROCESSING_CONFIGURATION_VERSION=processing-v1
RETRIEVAL_CONFIGURATION_VERSION=hybrid-v1
ANSWER_PROMPT_VERSION=answer-v1
CHUNK_TARGET_TOKENS=650
CHUNK_MAX_TOKENS=800
CHUNK_OVERLAP_TOKENS=100
MIN_PAGE_TEXT_CHARACTERS=80
LEXICAL_CANDIDATE_COUNT=20
VECTOR_CANDIDATE_COUNT=20
FUSED_CANDIDATE_COUNT=20
FINAL_CONTEXT_CHUNK_COUNT=8
MIN_EVIDENCE_SCORE=0.35
MAX_CONTEXT_TOKENS=7000
MAX_QUESTION_CHARACTERS=4000
MAX_CONVERSATION_SUMMARY_CHARACTERS=4000
MAX_SELECTED_DOCUMENTS=20

# File and processing limits
MAX_UPLOAD_BYTES=104857600
MAX_DOCUMENT_PAGES=500
MAX_EXTRACTED_TEXT_CHARACTERS=10000000
MAX_PROCESSING_SECONDS=1800
PDF_PAGE_BATCH_SIZE=10
CHUNK_BULK_WRITE_SIZE=100
TEMP_DIRECTORY=./.local/askpdf-temp
MAX_TEMP_BYTES_PER_JOB=157286400
ENABLE_OCR=false
OCR_PROVIDER=disabled
OCR_PAGE_CONCURRENCY=1
OCR_PAGE_TIMEOUT_MS=60000

# Optional malware scan
ENABLE_MALWARE_SCAN=false
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=30000

# Rate limits and quotas
LOGIN_RATE_LIMIT_PER_15_MINUTES=10
REGISTER_RATE_LIMIT_PER_HOUR=5
UPLOAD_INTENT_RATE_LIMIT_PER_HOUR=20
QUESTION_RATE_LIMIT_PER_MINUTE=10
QUESTION_RATE_LIMIT_PER_HOUR=60
MAX_READY_DOCUMENTS_PER_WORKSPACE=200
MAX_STORAGE_BYTES_PER_WORKSPACE=1073741824

# Observability
SENTRY_DSN=
SENTRY_ENVIRONMENT=local
SENTRY_TRACES_SAMPLE_RATE=0.0
METRICS_ENABLED=true
METRICS_PORT=9464
OTEL_EXPORTER_OTLP_ENDPOINT=
LOG_REDACT_FIELDS=req.headers.authorization,req.headers.cookie,res.headers.set-cookie,upload.url,viewUrl

# Feature flags
FEATURE_COLLECTIONS=true
FEATURE_MULTI_DOCUMENT_QA=true
FEATURE_ANSWER_CACHE=true
FEATURE_OCR=false
FEATURE_WORKSPACE_INVITES=false
FEATURE_STREAMING_ANSWERS=true

# Test only values
TEST_MONGODB_URI=mongodb://askpdf_test:askpdf_test_password@localhost:27018/askpdf_test?authSource=admin&replicaSet=rs0&directConnection=true
TEST_REDIS_URL=redis://:askpdf_test_redis_password@localhost:6380/0
TEST_STORAGE_ENDPOINT=http://localhost:9001
TEST_STORAGE_BUCKET=askpdf-test-private
TEST_STORAGE_ACCESS_KEY_ID=askpdf_test_access
TEST_STORAGE_SECRET_ACCESS_KEY=askpdf_test_secret
TEST_GEMINI_MODE=mock
RUN_ATLAS_INTEGRATION_TESTS=false
ATLAS_TEST_MONGODB_URI=
```

`PROCESSING_CONFIGURATION_VERSION` implements the recommended resolution to conflict C-05. It replaces ingestion's unrelated required `promptVersion`; the final choice still requires plan approval before the model is implemented. `FEATURE_STREAMING_ANSWERS=true` follows the latest direct instruction and overrides the older deferred flag, while raw model tokens remain blocked until validation.

| Setting                             |                                     Initial value | Authority                                                                  |
| ----------------------------------- | ------------------------------------------------: | -------------------------------------------------------------------------- |
| Maximum upload                      |                                           100 MiB | Confirmed specification                                                    |
| Maximum pages                       |                                               500 | Confirmed specification                                                    |
| Worker concurrency                  |                                     2 per process | Confirmed specification                                                    |
| Extraction batch                    |                                          10 pages | Confirmed specification                                                    |
| Embedding batch/concurrency         |                                            32 / 2 | Confirmed specification                                                    |
| Retrieval candidates                |       20 vector + 20 lexical, fuse to 20, final 8 | Confirmed specification                                                    |
| Generated-answer context            |                         7,000 tokens and 8 chunks | Confirmed specification                                                    |
| Selected documents                  |                                                20 | Confirmed specification                                                    |
| Job retry                           | 3 attempts, 2-second exponential base plus jitter | Confirmed specification                                                    |
| Questions                           |                  10/minute burst and 60/hour/user | Confirmed specification                                                    |
| Upload intents                      |                                      20/hour/user | Confirmed specification                                                    |
| Ready documents/storage quota       |                           200 and 1 GiB/workspace | Confirmed specification                                                    |
| Login/register                      |                  10/15 minutes account+IP; 5/hour | Confirmed specification                                                    |
| Progress/answer/query-embedding TTL |                   86,400 / 3,600 / 86,400 seconds | Confirmed specification                                                    |
| Signed upload/read URL TTL          |                                 900 / 600 seconds | Confirmed specification                                                    |
| Temporary storage                   |                                       150 MiB/job | Confirmed specification                                                    |
| Queue priority                      |             retry 1, new upload 5, maintenance 10 | Proposed default; verify pinned BullMQ semantics                           |
| `PROCESSING_CONFIGURATION_VERSION`  |                                   `processing-v1` | Proposed C-05 resolution; approval required before Day 3                   |
| Answer SSE                          |                                           enabled | Latest direct instruction; additive to the older JSON-only answer contract |

## Complete local `docker-compose.yml`

```yaml
name: askpdf

services:
  mongo-keyfile:
    image: mongo:8.0.29
    restart: "no"
    user: "0:0"
    entrypoint:
      - bash
      - -ec
      - |
        if [ ! -s /keyfile/mongo-keyfile ]; then
          openssl rand -base64 756 > /keyfile/mongo-keyfile
          chown 999:999 /keyfile/mongo-keyfile
          chmod 400 /keyfile/mongo-keyfile
        fi
    volumes:
      - mongo-keyfile:/keyfile

  mongo:
    image: mongo:8.0.29
    restart: unless-stopped
    depends_on:
      mongo-keyfile:
        condition: service_completed_successfully
    command:
      - mongod
      - --replSet
      - rs0
      - --bind_ip_all
      - --auth
      - --keyFile
      - /run/mongo-keyfile/mongo-keyfile
    environment:
      MONGO_INITDB_ROOT_USERNAME: askpdf_root
      MONGO_INITDB_ROOT_PASSWORD: askpdf_root_password_change_outside_local
      MONGO_INITDB_DATABASE: askpdf
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongo-data:/data/db
      - mongo-keyfile:/run/mongo-keyfile:ro
      - ./scripts/docker/mongo-init.js:/docker-entrypoint-initdb.d/01-create-app-users.js:ro
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          mongosh --quiet --username askpdf_root --password askpdf_root_password_change_outside_local
          --authenticationDatabase admin --eval
          "try { quit(rs.status().ok === 1 ? 0 : 1) } catch (error) {
          const result = rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]});
          quit(result.ok === 1 ? 0 : 1) }"
      interval: 5s
      timeout: 5s
      retries: 30
      start_period: 20s

  redis:
    image: redis:8.2.9-alpine
    restart: unless-stopped
    command:
      - redis-server
      - --appendonly
      - "yes"
      - --appendfsync
      - everysec
      - --maxmemory-policy
      - noeviction
      - --requirepass
      - askpdf_redis_password
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "askpdf_redis_password", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: askpdf_local_access
      MINIO_ROOT_PASSWORD: askpdf_local_secret_change_before_deploy
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9002:9001"
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 3s
      retries: 20

  minio-init:
    image: minio/mc:RELEASE.2025-08-13T08-35-41Z
    restart: "no"
    depends_on:
      minio:
        condition: service_healthy
    entrypoint:
      - /bin/sh
      - -ec
      - |
        mc alias set local http://minio:9000 askpdf_local_access askpdf_local_secret_change_before_deploy
        mc mb --ignore-existing local/askpdf-private
        mc anonymous set none local/askpdf-private

volumes:
  minio-data:
  mongo-data:
  mongo-keyfile:
  redis-data:
```

### `scripts/docker/mongo-init.js`

```javascript
const adminDatabase = db.getSiblingDB("admin");

if (adminDatabase.getUser("askpdf_dev") === null) {
  adminDatabase.createUser({
    user: "askpdf_dev",
    pwd: "askpdf_dev_password",
    roles: [{ role: "readWrite", db: "askpdf" }],
  });
}

if (adminDatabase.getUser("askpdf_test") === null) {
  adminDatabase.createUser({
    user: "askpdf_test",
    pwd: "askpdf_test_password",
    roles: [{ role: "readWrite", db: "askpdf_test" }],
  });
}
```

The Compose stack is local-only. Production uses managed Atlas, Redis, and S3-compatible credentials from the deployment secret store, never these development values.

# 2. CORE ARCHITECTURE INTERFACES & SCHEMAS

These are the canonical cross-process contracts. They intentionally contain no Mongoose objects, Express request objects, BullMQ classes, or provider SDK types, so the web, API, and worker can depend on them without reversing dependency direction. All external input must be parsed with these schemas before use.

The proposed resolution to conflict C-05 is reflected below: ingestion runs store `processingConfigurationVersion`, not `promptVersion`. This field choice still requires approval before Day 3 begins.

## `packages/contracts/src/common.ts`

```typescript
import { z } from "zod";

export const ObjectIdStringSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Expected a MongoDB ObjectId string");
export const UuidSchema = z.uuid();
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const NonEmptyTextSchema = z.string().trim().min(1);
export const CursorSchema = z.string().min(1).max(2048);

export const ErrorCodeSchema = z.enum([
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
  "NOT_READY",
  "PROCESSING_REJECTED",
  "PROGRESS_UNAVAILABLE",
  "RATE_LIMITED",
  "RUN_NOT_FOUND",
  "SEARCH_UNAVAILABLE",
  "SESSION_REUSE_DETECTED",
  "STATE_CONFLICT",
  "STORAGE_UNAVAILABLE",
  "UNSUPPORTED_FILE_TYPE",
  "UPLOAD_INTENT_NOT_FOUND",
  "UPLOAD_NOT_FOUND",
  "VALIDATION_ERROR",
]);

export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: NonEmptyTextSchema,
    requestId: NonEmptyTextSchema,
    details: z
      .array(
        z.strictObject({
          path: z.string().min(1),
          issue: z.string().min(1),
        }),
      )
      .optional(),
  }),
});

export const PaginationMetaSchema = z.strictObject({
  nextCursor: CursorSchema.nullable(),
  hasMore: z.boolean(),
});

export function dataEnvelope<T extends z.ZodType>(schema: T) {
  return z.strictObject({ data: schema });
}

export type ObjectIdString = z.infer<typeof ObjectIdStringSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
```

## `packages/contracts/src/domain.ts`

```typescript
import { z } from "zod";
import { IsoDateTimeSchema, NonEmptyTextSchema, ObjectIdStringSchema } from "./common.js";

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export const DocumentStatusSchema = z.enum([
  "awaiting_upload",
  "queued",
  "validating",
  "extracting",
  "ocr",
  "cleaning",
  "chunking",
  "embedding",
  "indexing",
  "ready",
  "failed",
  "cancelled",
  "deleting",
]);
export const ProcessingStageSchema = z.enum([
  "queued",
  "validating",
  "extracting",
  "ocr",
  "cleaning",
  "chunking",
  "embedding",
  "indexing",
  "ready",
  "failed",
  "cancelled",
]);
export const MessageRoleSchema = z.enum(["user", "assistant"]);
export const MessageStatusSchema = z.enum(["pending", "completed", "failed"]);

export const UserDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  email: z.email(),
  displayName: NonEmptyTextSchema.max(80),
  status: z.enum(["active", "disabled"]),
});

export const WorkspaceDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  name: NonEmptyTextSchema.max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  role: WorkspaceRoleSchema,
});

export const DocumentDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  displayName: NonEmptyTextSchema.max(160),
  originalFilename: NonEmptyTextSchema.max(255),
  sizeBytes: z.number().int().positive(),
  pageCount: z.number().int().positive().nullable(),
  status: DocumentStatusSchema,
  processingVersion: z.number().int().positive(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema.optional(),
});

export const CollectionDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  name: NonEmptyTextSchema.max(100),
  description: z.string().max(500),
  documentIds: z.array(ObjectIdStringSchema).max(100),
  createdAt: IsoDateTimeSchema,
});

export const ConversationDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  title: NonEmptyTextSchema.max(120),
  selectedDocumentIds: z.array(ObjectIdStringSchema).min(1).max(20),
  collectionId: ObjectIdStringSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});

export const CitationDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  documentId: ObjectIdStringSchema,
  documentName: NonEmptyTextSchema.max(160),
  chunkId: ObjectIdStringSchema,
  processingVersion: z.number().int().positive().optional(),
  pageNumber: z.number().int().positive(),
  excerpt: NonEmptyTextSchema.max(600),
  ordinal: z.number().int().nonnegative().optional(),
});

export const MessageDtoSchema = z.strictObject({
  id: ObjectIdStringSchema,
  role: MessageRoleSchema,
  status: MessageStatusSchema,
  content: z.string().max(20_000),
  insufficientEvidence: z.boolean(),
  citations: z.array(CitationDtoSchema),
  createdAt: IsoDateTimeSchema.optional(),
});

export const ProcessingProgressSchema = z.strictObject({
  documentId: ObjectIdStringSchema,
  processingVersion: z.number().int().positive(),
  stage: ProcessingStageSchema,
  stageSequence: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  message: NonEmptyTextSchema.max(300),
  occurredAt: IsoDateTimeSchema,
});

export type DocumentDto = z.infer<typeof DocumentDtoSchema>;
export type ConversationDto = z.infer<typeof ConversationDtoSchema>;
export type MessageDto = z.infer<typeof MessageDtoSchema>;
export type CitationDto = z.infer<typeof CitationDtoSchema>;
export type ProcessingProgress = z.infer<typeof ProcessingProgressSchema>;
```

## `packages/contracts/src/api.ts`

```typescript
import { z } from "zod";
import { dataEnvelope, ObjectIdStringSchema } from "./common.js";
import { ConversationDtoSchema, DocumentDtoSchema, MessageDtoSchema } from "./domain.js";

const PasswordSchema = z.string().min(12).max(128);

export const RegisterRequestSchema = z.strictObject({
  email: z.email(),
  password: PasswordSchema,
  displayName: z.string().trim().min(2).max(80),
});
export const LoginRequestSchema = z.strictObject({
  email: z.email(),
  password: PasswordSchema,
});

export const CreateUploadIntentRequestSchema = z.strictObject({
  workspaceId: ObjectIdStringSchema,
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(104_857_600),
  sha256: z.string().regex(/^[a-f\d]{64}$/),
  contentType: z.literal("application/pdf"),
});
export const CreateUploadIntentResponseSchema = dataEnvelope(
  z.strictObject({
    uploadIntentId: ObjectIdStringSchema,
    upload: z.strictObject({
      method: z.literal("PUT"),
      url: z.url(),
      headers: z.record(z.string(), z.string()),
      expiresAt: z.iso.datetime({ offset: true }),
      maxSizeBytes: z.number().int().positive(),
    }),
  }),
);

export const CompleteUploadRequestSchema = z.strictObject({
  workspaceId: ObjectIdStringSchema,
});
export const CompleteUploadResponseSchema = dataEnvelope(
  z.strictObject({
    document: DocumentDtoSchema,
    job: z.strictObject({
      id: z.string().min(3).max(100),
      status: z.literal("queued"),
    }),
  }),
);

export const UpdateDocumentRequestSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(160),
});
export const ReprocessDocumentRequestSchema = z.strictObject({
  reason: z.enum(["manual_retry", "configuration_change", "admin_reindex"]),
});

export const CreateConversationRequestSchema = z.strictObject({
  workspaceId: ObjectIdStringSchema,
  title: z.string().trim().min(1).max(120),
  selectedDocumentIds: z.array(ObjectIdStringSchema).min(1).max(20),
  collectionId: ObjectIdStringSchema.nullable(),
});
export const CreateConversationResponseSchema = dataEnvelope(ConversationDtoSchema);

export const AskQuestionRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(4000),
  clientRequestId: z.uuid(),
});
export const AskQuestionJsonResponseSchema = dataEnvelope(
  z.strictObject({
    questionMessage: z.strictObject({
      id: ObjectIdStringSchema,
      role: z.literal("user"),
      content: z.string().min(1).max(4000),
      createdAt: z.iso.datetime({ offset: true }),
    }),
    answerMessage: MessageDtoSchema,
    meta: z.strictObject({
      cached: z.boolean(),
      model: z.string().min(1).nullable(),
      promptVersion: z.string().min(1),
      retrievalConfigurationVersion: z.string().min(1),
      latencyMs: z.number().int().nonnegative(),
    }),
  }),
);

export const IdPathParamsSchema = z.strictObject({ id: ObjectIdStringSchema });
export const CursorQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
```

## `packages/contracts/src/jobs.ts`

Job payloads carry stable identifiers and versions only. The worker reloads authoritative state inside a tenant-scoped repository and verifies that the requested document version is still current before every irreversible stage.

```typescript
import { z } from "zod";
import { ObjectIdStringSchema } from "./common.js";

export const QUEUE_NAMES = {
  documentIngest: "documents.ingest.v1",
  documentDelete: "documents.delete.v1",
  deadLetter: "documents.dead-letter.v1",
} as const;

export const DocumentIngestJobV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: ObjectIdStringSchema,
  documentId: ObjectIdStringSchema,
  processingVersion: z.number().int().positive(),
  processingRunId: ObjectIdStringSchema,
  requestedByUserId: ObjectIdStringSchema,
  correlationId: z.string().min(1).max(128),
});

export const DocumentDeleteJobV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: ObjectIdStringSchema,
  documentId: ObjectIdStringSchema,
  requestedByUserId: ObjectIdStringSchema,
  correlationId: z.string().min(1).max(128),
});

export type DocumentIngestJobV1 = z.infer<typeof DocumentIngestJobV1Schema>;
export type DocumentDeleteJobV1 = z.infer<typeof DocumentDeleteJobV1Schema>;
```

## `packages/contracts/src/sse.ts`

The answer stream emits lifecycle events immediately, but never emits unvalidated model text. The API buffers the draft, validates claim-to-citation mappings, persists the final message, then emits `answer.complete` with the citation-safe artifact.

```typescript
import { z } from "zod";
import { ErrorEnvelopeSchema, ObjectIdStringSchema } from "./common.js";
import { MessageDtoSchema, ProcessingProgressSchema } from "./domain.js";

export const ProcessingStreamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("processing.snapshot"), data: ProcessingProgressSchema }),
  z.strictObject({ type: z.literal("processing.progress"), data: ProcessingProgressSchema }),
  z.strictObject({ type: z.literal("processing.complete"), data: ProcessingProgressSchema }),
  z.strictObject({
    type: z.literal("processing.failed"),
    data: z.strictObject({
      documentId: ObjectIdStringSchema,
      failureCode: z.string().min(1).max(100),
      retryable: z.boolean(),
    }),
  }),
]);

export const AnswerStreamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("answer.accepted"),
    data: z.strictObject({ requestId: z.string().min(1), messageId: ObjectIdStringSchema }),
  }),
  z.strictObject({
    type: z.literal("answer.stage"),
    data: z.strictObject({
      stage: z.enum(["retrieving", "reranking", "generating", "validating"]),
    }),
  }),
  z.strictObject({ type: z.literal("answer.complete"), data: MessageDtoSchema }),
  z.strictObject({ type: z.literal("answer.error"), data: ErrorEnvelopeSchema.shape.error }),
]);

export type ProcessingStreamEvent = z.infer<typeof ProcessingStreamEventSchema>;
export type AnswerStreamEvent = z.infer<typeof AnswerStreamEventSchema>;
```

## `packages/database/src/model-types.ts`

These persistence records make version, tenant, ownership, TTL, and audit fields explicit. Concrete Mongoose schemas must mirror them and declare the indexes from `01_Data_Schema_and_Model_Definitions.docx`.

```typescript
import type { Types } from "mongoose";

type Id = Types.ObjectId;
type Timestamps = { createdAt: Date; updatedAt: Date };
type TenantOwned = { workspaceId: Id };

export type UserRecord = Timestamps & {
  _id: Id;
  email: string;
  passwordHash: string;
  displayName: string;
  status: "active" | "disabled";
  lastLoginAt: Date | null;
  schemaVersion: number;
};

export type WorkspaceRecord = Timestamps & {
  _id: Id;
  name: string;
  slug: string;
  ownerId: Id;
  plan: "free" | "project";
  deletedAt: Date | null;
  schemaVersion: number;
};

export type WorkspaceMemberRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    userId: Id;
    role: "owner" | "admin" | "member" | "viewer";
    invitedByUserId: Id | null;
    joinedAt: Date;
  };

export type AuthSessionRecord = Timestamps & {
  _id: Id;
  userId: Id;
  refreshTokenHash: string;
  userAgentHash: string;
  ipPrefix: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: Id | null;
};

export type UploadIntentRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    requestedByUserId: Id;
    objectKey: string;
    originalFilename: string;
    declaredContentType: "application/pdf";
    expectedSizeBytes: number;
    expectedSha256: string;
    status: "pending" | "uploaded" | "completed" | "aborted" | "expired";
    expiresAt: Date;
    completedAt: Date | null;
  };

export type DocumentRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    ownerId: Id;
    uploadedByUserId: Id;
    uploadIntentId: Id;
    storageBucket: string;
    storageKey: string;
    originalFilename: string;
    displayName: string;
    mimeType: "application/pdf";
    sizeBytes: number;
    sha256: string;
    pageCount: number | null;
    status:
      | "awaiting_upload"
      | "queued"
      | "validating"
      | "extracting"
      | "ocr"
      | "cleaning"
      | "chunking"
      | "embedding"
      | "indexing"
      | "ready"
      | "failed"
      | "cancelled"
      | "deleting";
    activeProcessingVersion: number;
    readyProcessingVersion: number | null;
    failureCode: string | null;
    failureMessage: string | null;
    deletedAt: Date | null;
    schemaVersion: number;
  };

export type DocumentProcessingRunRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    documentId: Id;
    processingVersion: number;
    jobId: string;
    status: "queued" | "running" | "completed" | "failed" | "cancelled";
    stage:
      | "queued"
      | "validating"
      | "extracting"
      | "ocr"
      | "cleaning"
      | "chunking"
      | "embedding"
      | "indexing"
      | "ready"
      | "failed"
      | "cancelled";
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
  };

export type DocumentChunkRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    documentId: Id;
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
  };

export type DocumentCollectionRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    createdByUserId: Id;
    name: string;
    description: string;
    documentIds: Id[];
    deletedAt: Date | null;
  };

export type ConversationRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    createdByUserId: Id;
    title: string;
    selectedDocumentIds: Id[];
    collectionId: Id | null;
    collectionUpdatedAtSnapshot: Date | null;
    summary: string | null;
    archivedAt: Date | null;
    deletedAt: Date | null;
  };

export type MessageRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    conversationId: Id;
    role: "user" | "assistant";
    status: "pending" | "completed" | "failed";
    content: string;
    normalizedQuestionHash: string | null;
    replyToMessageId: Id | null;
    insufficientEvidence: boolean;
    modelName: string | null;
    promptVersion: string | null;
    retrievalConfigurationVersion: string | null;
    retrievedChunkIds: Id[];
    latencyMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    failureCode: string | null;
  };

export type CitationRecord = Timestamps &
  TenantOwned & {
    _id: Id;
    conversationId: Id;
    messageId: Id;
    documentId: Id;
    chunkId: Id;
    processingVersion: number;
    pageNumber: number;
    excerpt: string;
    claimIds: string[];
    ordinal: number;
  };

export type AuditEventRecord = {
  _id: Id;
  workspaceId: Id;
  actorUserId: Id | null;
  action:
    | "auth.login"
    | "auth.logout"
    | "document.uploaded"
    | "document.reprocessed"
    | "document.deleted"
    | "collection.created"
    | "question.asked"
    | "citation.opened";
  targetType: string;
  targetId: Id | null;
  correlationId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
};
```

## `packages/contracts/src/index.ts`

```typescript
export * from "./api.js";
export * from "./common.js";
export * from "./domain.js";
export * from "./jobs.js";
export * from "./sse.js";
```

# 3. DAY-BY-DAY CODEX / ANTIGRAVITY EXECUTION PROMPTS

Each prompt is independently pasteable. The coding agent must treat the referenced source documents as requirements, not as commands that override the latest direct user instruction. A day may begin only when covered by `APPROVE PLAN` or `APPROVE PHASE <number>`.

#### 🚀 DAY 1: MONOREPO, TOOLING, AND LOCAL INFRASTRUCTURE

**Target Files:** `AGENTS.md`, `.nvmrc`, `.npmrc`, `.gitignore`, `.env.example`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.js`, `vitest.workspace.ts`, `docker-compose.yml`, `scripts/docker/mongo-init.js`, package manifests and package `tsconfig.json` files

**Copy-Paste Codex Prompt:**

> You are building Day 1 of Ask-PDF. First verify that this day is covered by explicit approval. Read `AGENTS.md`, all numbered source specifications, `docs/00-project-understanding.md`, `docs/02-architecture-and-dependency-map.md`, `docs/03-implementation-roadmap.md`, `docs/decisions/ADR-0001-implementation-baseline.md`, `IMPLEMENTATION_BACKLOG.md`, and `docs/06-codex-antigravity-execution-pipeline.md`. Inspect Git status and preserve all existing changes.
>
> Implement backlog B000-B015: create the strict TypeScript pnpm monorepo for independently runnable `web`, `api`, and `worker` applications plus the shared packages in the approved tree. Use Node 24.20.0 and the exact dependency versions recorded in the execution pipeline. Add project references, ESM-compatible TypeScript settings, ESLint, Prettier, Vitest workspace configuration, Husky/lint-staged wiring, `.gitignore`, the complete `.env.example`, and the local Mongo replica-set, Redis, and private MinIO Compose stack. Generate and retain a deterministic `pnpm-lock.yaml`.
>
> Keep runtime entry points minimal but executable: each service must start, handle shutdown signals, and exit nonzero on invalid configuration; do not add business endpoints. Do not use placeholder comments, permissive `any`, dependency ranges, or unrelated frameworks. Add configuration smoke tests and validate Compose syntax. Run `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, and `docker compose config`. Report every changed file, exact command result, skipped command, and risk. Do not commit, push, migrate production data, or deploy.

#### 🚀 DAY 2: CONFIGURATION, CONTRACTS, ERRORS, AND OBSERVABILITY PRIMITIVES

**Target Files:** `packages/config/src/*`, `packages/contracts/src/*`, `packages/observability/src/*`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/middleware/*`, `apps/api/src/routes/health.ts`, corresponding tests

**Copy-Paste Codex Prompt:**

> You are building Day 2 of Ask-PDF. Confirm explicit approval, read `AGENTS.md`, Specs 02 and 06, the ADR, roadmap, backlog, and execution pipeline, then inspect the affected files and Git status.
>
> Implement backlog B016-B025 and the canonical contracts from Section 2. Parse environment variables once with strict Zod schemas; maintain separate API, worker, and web-safe configuration exports so secrets can never enter the frontend bundle. Implement typed success/error envelopes, request IDs, Pino redaction, structured request logs, process-level error reporting, health/readiness endpoints, CORS allowlisting, Helmet defaults, payload limits, 404 handling, and a single error boundary that does not expose stacks or secrets. Readiness must distinguish Mongo, Redis, storage, and Gemini dependencies without leaking credentials.
>
> Use pure functions for schema conversion and test them. Add unit and Supertest coverage for invalid configuration, request-ID propagation, redaction, malformed JSON, unknown routes, health, readiness, and safe errors. Use no placeholder branches or unsafe casts. Run filtered unit/integration tests, lint, typecheck, and build, then report changes and evidence. Do not commit or deploy.

#### 🚀 DAY 3: DATABASE MODELS, INDEXES, AND TENANT-SCOPED REPOSITORIES

**Target Files:** `packages/database/src/connection.ts`, `packages/database/src/models/*`, `packages/database/src/repositories/*`, `packages/database/src/indexes/*`, `scripts/indexes/*`, `tests/integration/database/*`

**Copy-Paste Codex Prompt:**

> You are building Day 3 of Ask-PDF. Confirm explicit approval and confirm the recorded C-05 decision: `DocumentProcessingRun` must use the approved ingestion-version field. If that decision is not approved, stop without edits and report the exact blocker. Read `AGENTS.md`, Spec 01 completely, the ADR, architecture map, roadmap, backlog B026-B041, and Section 2 of the execution pipeline. Inspect existing files and Git status.
>
> Implement production Mongoose schemas and typed repositories for User, Workspace, WorkspaceMember, AuthSession, UploadIntent, Document, DocumentProcessingRun, DocumentChunk, DocumentCollection, Conversation, Message, Citation, and AuditEvent. Reproduce every required unique, compound, partial, and TTL index from Spec 01. Every tenant-owned repository method must require `workspaceId` as an explicit parameter and include it inside the database predicate; no caller-supplied filter may weaken it. Store lowercase normalized emails, hashed refresh tokens, soft-deletion state, immutable document/version references, deterministic chunk IDs, model/version metadata, and bounded safe error fields. Exclude refresh hashes, storage coordinates, raw embeddings, content hashes, and retrieved candidate IDs from default projections.
>
> Add idempotent local index synchronization and Atlas search-index validation scripts; never mutate Atlas automatically. Use transactions only where replica-set semantics require atomic multi-document state changes. Test index declarations, uniqueness, TTL fields, tenant isolation, optimistic status/version transitions, and repository projection safety with Testcontainers. Run the database unit and integration suites, lint, typecheck, and build. Report exact results and do not commit, deploy, or touch production.

#### 🚀 DAY 4: AUTHENTICATION AND WORKSPACE AUTHORIZATION

**Target Files:** `apps/api/src/routes/v1/auth.ts`, `apps/api/src/application/auth-service.ts`, `apps/api/src/application/authorization-service.ts`, `apps/api/src/middleware/authenticate.ts`, `apps/api/src/middleware/require-workspace-role.ts`, `packages/database/src/repositories/auth-session-repository.ts`, auth tests

**Copy-Paste Codex Prompt:**

> You are building Day 4 of Ask-PDF. Confirm approval; read `AGENTS.md`, Specs 01-03 and 06, the security plan, roadmap, and backlog B042-B057. Inspect the repository and preserve user changes.
>
> Implement registration, login, refresh, logout, and current-user endpoints using Argon2id password hashing, short-lived signed access tokens, and single-use opaque refresh tokens whose SHA-256-plus-pepper hashes alone are stored. Deliver access and refresh values in separate Secure, HttpOnly, SameSite=Lax cookies with configurable domain and expiry; issue a session-bound CSRF token for mutations. Registration must atomically create a user, personal workspace, owner membership, and session. Validate fixed JWT algorithm, issuer, audience, token type, subject, session ID, and expiry. Normalize emails consistently, prevent account enumeration, rotate refresh sessions transactionally, revoke the entire replacement chain on reuse, and emit redacted audit events.
>
> Implement authentication and workspace-authorization middleware that derives identity and workspace access server-side. Never trust workspace IDs, roles, ownership, or document versions from a cookie or client claim. Return the canonical error envelope. Add brute-force rate limits and tests for success, duplicate registration, invalid credentials, expiry, revocation, cookie flags, role denial, cross-workspace denial, timing-safe token comparison, and log redaction. Run unit, API integration, security-focused tests, lint, typecheck, and build; report evidence and do not commit or deploy.

#### 🚀 DAY 5: DOCUMENT METADATA AND DIRECT OBJECT-STORAGE UPLOADS

**Target Files:** `packages/storage/src/*`, `apps/api/src/routes/v1/documents.ts`, `apps/api/src/routes/v1/uploads.ts`, `apps/api/src/application/document-service.ts`, `apps/api/src/application/upload-service.ts`, document/storage tests

**Copy-Paste Codex Prompt:**

> You are building Day 5 of Ask-PDF. Confirm approval and read `AGENTS.md`, Specs 01, 02, 03, 05, and 06, the architecture map, roadmap, and backlog B058-B073. Inspect affected code and Git status.
>
> Implement tenant-scoped document metadata and a two-step direct-to-S3-compatible upload flow: create upload intent and complete upload. Generate server-owned, opaque object keys; return short-lived presigned PUT URLs; constrain MIME, declared size, checksum metadata, and required headers; and never expose storage credentials or accept a client object key. On completion, perform bounded HEAD/range validation for existence, exact size, metadata SHA-256, and PDF magic bytes, then atomically create the document/run and enqueue exactly one version-aware ingestion request through an injected queue interface. The worker must independently revalidate the complete object and compute SHA-256. Add upload-intent TTL, idempotent completion, duplicate-hash policy hooks, per-user/workspace quotas, document list/detail/rename routes, and private signed download URLs only after authorization.
>
> Enforce the proposed 100 MiB and 500-page limits as configurable defaults, not hidden constants. Cover expired intents, size/MIME/checksum mismatch, replay, missing objects, cross-tenant access, duplicate upload completion, storage failure, and successful enqueue using MinIO/Testcontainers or an equivalent isolated integration fixture. Run tests, lint, typecheck, and build; report exact results without committing or deploying.

#### 🚀 DAY 6: BULLMQ, IDEMPOTENT STATE MACHINE, CANCELLATION, AND PROGRESS SSE

**Target Files:** `packages/queue/src/*`, `apps/worker/src/worker.ts`, `apps/worker/src/processors/ingest-document-processor.ts`, `apps/api/src/routes/v1/document-events.ts`, queue/SSE tests

**Copy-Paste Codex Prompt:**

> You are building Day 6 of Ask-PDF. Confirm approval; read `AGENTS.md`, Specs 01-04 and 06, the architecture and test plans, and backlog B074-B091. Inspect repository state first.
>
> Implement BullMQ connection factories, versioned queue names and payload validation, deterministic job IDs, exponential retry with jitter, dead-letter records, bounded concurrency, rate limiting, backpressure checks, graceful shutdown, and structured job logs. Implement the document ingestion state machine with atomic stage transitions, processing checkpoints, lease/heartbeat handling, stale-run recovery, cooperative cancellation between bounded batches, and idempotent resume. A job must no-op safely if its document version is superseded, already complete, deleted, or owned by a different workspace.
>
> Implement authorized document-status SSE with an initial snapshot, progress events, keepalives, replay support via event IDs, terminal events, connection limits, and cleanup on disconnect. Redis pub/sub may accelerate delivery but Mongo remains authoritative so reconnects recover state. Test duplicate delivery, concurrent workers, retry exhaustion, cancellation, resume, stale leases, tenant isolation, Redis interruption, SSE reconnect, and listener cleanup. Run the queue/worker/API suites, lint, typecheck, and build, then report evidence. Do not commit or deploy.

#### 🚀 DAY 7: BOUNDED PDF VALIDATION, EXTRACTION, AND CHECKPOINTING

**Target Files:** `packages/rag/src/ingestion/*`, `apps/worker/src/stages/validate-stage.ts`, `apps/worker/src/stages/extract-stage.ts`, `tests/fixtures/pdfs/*`, extraction tests

**Copy-Paste Codex Prompt:**

> You are building Day 7 of Ask-PDF. Confirm approval; read `AGENTS.md`, Specs 01, 04, 05, and 06, the accuracy and security plans, and backlog B092-B104. Inspect affected code and current changes.
>
> Implement worker PDF revalidation and page-batched extraction with `pdfjs-dist`. Stream the object into an isolated per-job temporary directory with byte bounds; verify PDF magic bytes, actual size, SHA-256, encryption status, and the configurable page limit before costly work. Extract in configurable batches of 10 pages, record page number and source offsets, update checkpoints after durable batch writes, release parsed page resources promptly, and delete temporary files in a `finally` path on success, cancellation, and failure. Detect image-only or low-text pages and store an OCR-required signal without performing OCR.
>
> Reject malformed, encrypted, polyglot, decompression-bomb-like, oversized, path-manipulation, and parser-timeout inputs with safe stable failure codes. Never execute PDF actions, embedded JavaScript, attachments, URLs, or fonts outside the parser sandbox. Add deterministic fixtures and tests for normal, empty, scanned, encrypted, malformed, maximum-page, cancellation, resume, memory-bound, disk-bound, and cleanup behavior. Measure peak resource use for a large fixture. Run targeted worker tests, lint, typecheck, and build; report evidence and do not commit or deploy.

#### 🚀 DAY 8: NORMALIZATION, PAGE-AWARE CHUNKING, AND DETERMINISTIC IDENTIFIERS

**Target Files:** `packages/rag/src/normalization/*`, `packages/rag/src/chunking/*`, `apps/worker/src/stages/normalize-stage.ts`, `apps/worker/src/stages/chunk-stage.ts`, chunking tests

**Copy-Paste Codex Prompt:**

> You are building Day 8 of Ask-PDF. Confirm approval and read `AGENTS.md`, Specs 01 and 04, the accuracy plan, ADR, roadmap, and backlog B105-B115. Inspect existing extraction output and Git status.
>
> Implement deterministic Unicode/text normalization that preserves page provenance, paragraph boundaries, headings, lists, tables-as-text, formulas-as-text, and offsets needed for citation verification. Remove repeated headers/footers only when a deterministic frequency rule is satisfied and retain an audit record of normalization transforms. Implement page-aware chunking with configurable target token count and overlap, never combining unrelated pages without explicit page-span metadata. Generate chunk IDs from workspace-independent immutable inputs: document ID, document version, page span, ordinal, chunker version, and normalized-text hash.
>
> Persist chunks through idempotent bulk upserts keyed by document/version/chunk ID and remove only stale chunks for that same authorized version after successful replacement. Test determinism, Unicode, whitespace, repeated furniture, empty pages, long paragraphs, tables, page boundaries, overlap, stable IDs, retry/resume, and no cross-version deletion. Add property-based or table-driven boundary cases. Run focused tests, lint, typecheck, and build; report results without committing or deploying.

#### 🚀 DAY 9: GEMINI EMBEDDINGS, BATCHING, COST CONTROLS, AND INDEXING

**Target Files:** `packages/ai/src/providers/gemini-embedding-provider.ts`, `packages/ai/src/embeddings/embedding-provider.ts`, `apps/worker/src/stages/embed-stage.ts`, `apps/worker/src/stages/index-stage.ts`, embedding/index tests

**Copy-Paste Codex Prompt:**

> You are building Day 9 of Ask-PDF. Confirm approval; read `AGENTS.md`, Specs 01, 04, and 06, the architecture/test plans, and backlog B116-B129. Inspect code and user changes.
>
> Implement a narrow Gemini embedding adapter using the official Google GenAI SDK. Validate provider responses and configured vector dimensions, enforce request timeouts, bounded retries with jitter, provider rate limits, a circuit breaker, and structured usage/cost telemetry. Batch at the configurable default of 32 chunks while also enforcing token and payload limits. Cache embeddings only by embedding model/version plus normalized-text SHA-256; never use an unscoped document cache key. Write embeddings idempotently only when document/version and processing run are still current.
>
> Implement local index synchronization and Atlas vector/search index validation against documented definitions. Do not claim local Mongo provides Atlas hybrid-search parity and do not create or alter production indexes. Test batching, partial provider failures, 429/5xx handling, malformed dimensions, cache hits, version changes, cancellation, resume, stale-version writes, quota exhaustion, and secret redaction using a deterministic fake provider plus isolated database/Redis tests. Run targeted tests, lint, typecheck, and build; report evidence and do not commit or deploy.

#### 🚀 DAY 10: TENANT-SAFE HYBRID RETRIEVAL, RERANKING, AND EVIDENCE GATING

**Target Files:** `packages/rag/src/retrieval/*`, `packages/rag/src/ranking/*`, `packages/rag/src/evaluation/*`, `apps/api/src/application/question-service.ts`, `tests/integration/*`, `tests/rag-evaluation/*`

**Copy-Paste Codex Prompt:**

> You are building Day 10 of Ask-PDF. Confirm approval; read `AGENTS.md`, Specs 01-05, the architecture and evaluation plans, and backlog B130-B145. Inspect repository state.
>
> Implement hybrid vector and MongoDB Search retrieval with workspace ID, authorized document IDs, and exact active document versions embedded inside both search pipelines. Reject queries with no ready authorized scope. Normalize vector and lexical scores, fuse results deterministically with reciprocal-rank fusion, deduplicate chunk IDs, add diversity by document/page, and rerank through a versioned deterministic strategy. Apply the configurable top-k, context-token budget, minimum score, score-gap, and evidence-diversity thresholds. Return a typed evidence bundle or an explicit insufficient-evidence decision; retrieval must never silently widen scope.
>
> Cache only versioned, tenant-scoped retrieval artifacts and invalidate by document-version epochs. Log IDs, versions, timings, score summaries, and token counts without raw sensitive text. Add Atlas-backed integration tests for true hybrid behavior and deterministic fake/unit tests for local CI. Include adversarial tenant, deleted-version, superseded-version, empty-query, injection-text, lexical-only, vector-only, and low-evidence cases. Compute Hit@K and MRR against a versioned seed dataset. Run all retrieval/evaluation checks, lint, typecheck, and build; clearly label any Atlas test that could not run. Do not commit or deploy.

#### 🚀 DAY 11: GROUNDED ANSWERS, CITATION VALIDATION, ABSTENTION, AND ANSWER SSE

**Target Files:** `packages/ai/src/generation/*`, `packages/ai/src/providers/gemini-generation-provider.ts`, `packages/rag/src/citations/*`, `apps/api/src/routes/v1/conversations.ts`, `apps/api/src/routes/v1/question-stream.ts`, `apps/api/src/application/question-service.ts`, answer/citation/SSE tests

**Copy-Paste Codex Prompt:**

> You are building Day 11 of Ask-PDF. Confirm approval and read `AGENTS.md`, Specs 01-05, the ADR, architecture, test plan, and backlog B146-B164. Inspect all retrieval and message contracts before editing.
>
> Implement conversation question submission with idempotency by workspace, conversation, and `clientRequestId`. Build a prompt-injection-resistant evidence envelope that separates system instructions, the user question, and untrusted document text. Use the official Gemini adapter with timeouts, limits, schema-constrained draft output, prompt/model/retrieval version tracking, and usage telemetry. Require each factual claim to map to one or more retrieved chunk IDs. Validate that every citation belongs to an authorized scoped document/version, that page numbers match chunk metadata, and that quoted evidence occurs in normalized source text. Reject the draft or abstain if evidence thresholds, mapping, or quote checks fail.
>
> Persist user message, assistant message, and citations atomically. For SSE, emit accepted/stage events immediately but buffer model prose until all citations are valid; then emit one `answer.complete` artifact. Also support the canonical JSON fallback. Sanitize rendered Markdown and never expose hidden prompts. Test supported answers, insufficient evidence, prompt injection, fabricated chunk IDs, wrong pages, quote mismatch, mixed document versions, duplicate requests, disconnect/reconnect, provider failure, partial persistence rollback, citation precision/coverage, faithfulness, unsupported-claim rate, and correct refusal rate. Run unit, API integration, evaluation, lint, typecheck, and build; report evidence and do not commit or deploy.

#### 🚀 DAY 12: COLLECTIONS, CONVERSATION HISTORY, DOWNLOADS, AND SAFE DELETION

**Target Files:** `apps/api/src/routes/v1/collections.ts`, `apps/api/src/routes/v1/conversations.ts`, `apps/api/src/application/collection-service.ts`, `apps/api/src/application/conversation-service.ts`, `apps/api/src/application/document-service.ts`, `apps/worker/src/processors/delete-document-processor.ts`, resource/deletion tests

**Copy-Paste Codex Prompt:**

> You are building Day 12 of Ask-PDF. Confirm approval; read `AGENTS.md`, Specs 01-05, the architecture/test plans, and backlog B165-B178. Inspect code and Git status.
>
> Implement the remaining tenant-scoped CRUD contracts for collections, conversation list/detail/history, document downloads, reprocessing, cancellation, and deletion. Keep the conversation's selected document IDs and collection snapshot immutable; at each question, resolve and persist the exact authorized ready processing versions used for retrieval, and reject stale or reprocessing sources instead of silently widening or upgrading evidence. Validate collection document membership inside the same workspace. Use cursor pagination with stable sort keys and bounded limits. Reprocessing increments the desired processing version once, creates a new run, and remains idempotent.
>
> Implement two-phase deletion: atomically mark the document deleting and deny new reads, then use a retry-safe worker to remove versioned chunks, citations or retained audit-safe references according to the approved retention rule, cache keys, and private object-store keys before marking the tombstone complete. Object deletion targets must be loaded from tenant-scoped database records, never constructed from request text. Test pagination, update conflicts, cross-tenant IDs, historical version pinning, cancellation races, repeated deletion, partial storage/database failure, retry, cache invalidation, and audit events. Run tests, lint, typecheck, and build; report evidence and do not commit or deploy.

#### 🚀 DAY 13: CORE REACT EXPERIENCE AND COMPLETE UI STATE MAP

**Target Files:** `apps/web/src/app/*`, `apps/web/src/routes/*`, `apps/web/src/features/auth/*`, `apps/web/src/features/documents/*`, `apps/web/src/features/chat/*`, `apps/web/src/components/*`, `tests/e2e/*`

**Copy-Paste Codex Prompt:**

> You are building Day 13 of Ask-PDF. Confirm approval; read `AGENTS.md`, Spec 03 completely, Specs 02 and 05, the architecture/test plans, and backlog B179-B198. Inspect the frontend baseline and contracts.
>
> Implement the accessible React/Vite application with React Router, TanStack Query, Tailwind CSS, typed contract parsing, and feature-scoped modules. Build registration/login, authenticated shell, document library, upload dropzone with client-side size/type hints, upload progress, processing detail, collection management, conversation list, chat, citation chips, citation/source drawer, and document download. Treat server authorization as authoritative. Reconcile SSE updates into the query cache and fall back to bounded polling after repeated stream failures.
>
> Implement every loading, empty, success, stale, reconnecting, offline, validation, rate-limit, retryable-error, terminal-error, cancelling, cancelled, and deletion state from Spec 03. Disable questions until all selected versions are ready. Render assistant Markdown through a sanitizer, preserve keyboard/focus behavior, provide visible labels and live-region progress without excessive announcements, and never place secrets or private object keys in browser storage. Add component tests and Playwright journeys covering auth, upload-to-ready, retry/cancel, grounded answer/citation navigation, abstention, refresh/reconnect, responsive layout, and cross-workspace denial. Run frontend tests, e2e, accessibility checks, lint, typecheck, and build; report exact evidence without committing or deploying.

#### 🚀 DAY 14: SECURITY, EVALUATION, OBSERVABILITY, CI, AND RELEASE READINESS

**Target Files:** `tests/security/*`, `tests/load/*`, `tests/evaluation/*`, `scripts/evaluation/*`, `scripts/smoke/*`, `.github/workflows/*`, `Dockerfile*`, deployment manifests, runbooks under `docs/runbooks/*`

**Copy-Paste Codex Prompt:**

> You are building Day 14 of Ask-PDF. Confirm approval; read `AGENTS.md`, all source specs, all planning documents, the ADR, and backlog B199-B220. Inspect the complete implementation and Git status before changing anything.
>
> Close production-readiness gaps without expanding MVP scope. Add dependency, license, secret, SAST, and container scans; malicious-PDF and prompt-injection suites; tenant-isolation matrix tests; queue idempotency/retry tests; load and large-file tests; and a reproducible, versioned RAG evaluation runner calculating Hit@K, MRR, citation precision, citation coverage, faithfulness, unsupported-claim rate, correct refusal rate, ingestion success rate, and P95 processing/query latency. Encode thresholds from `docs/04-test-security-and-release-plan.md` as CI gates and retain machine-readable reports.
>
> Add Prometheus-compatible metrics, Sentry integration, trace/correlation propagation, redaction tests, dashboards/alerts definitions, multi-stage non-root container builds, health/readiness probes, graceful shutdown, deployment configuration for separately scalable web/API/worker services, staging smoke tests, backup/restore verification, rollback runbook, dead-letter replay runbook, index-change runbook, and incident checklist. Validate graceful degradation for Gemini, Redis, MongoDB, and S3 outages. Never insert real secrets or auto-create production resources. Run the complete lint, typecheck, unit, integration, security, evaluation, e2e, build, and Compose validation pipeline. Report every result and any unmet gate; do not claim readiness, commit, push, or deploy unless separately authorized.

# 4. MASTER WORKFLOW CHEAT SHEET

These commands become valid as the corresponding day creates each script. Run them from the repository root. Commands that mutate code, lockfiles, indexes, data, or infrastructure remain subject to the approval gate.

## Prerequisites and first approved bootstrap

Required local tools: Git, Docker Desktop with Compose v2, Node.js 24.20.0, and Corepack. The repository pins pnpm 11.25.0.

```powershell
node --version
docker --version
docker compose version
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
Copy-Item -LiteralPath .env.example -Destination .env
pnpm install
```

For POSIX shells, replace the environment copy command with:

```bash
cp .env.example .env
```

After `pnpm-lock.yaml` exists, CI and all clean installs must use:

```powershell
pnpm install --frozen-lockfile
```

Set `GEMINI_API_KEY` in the untracked `.env` only when a provider-backed test is intentionally run. Never paste production credentials into shell history, source files, test snapshots, or logs.

## Start and inspect local dependencies

```powershell
docker compose config
docker compose up -d mongo-keyfile mongo redis minio minio-init
docker compose ps
docker compose logs --tail 100 mongo redis minio minio-init
```

The Mongo container initializes a development-only single-node replica set so transactions and change-aware flows can be tested. The MinIO API is on `127.0.0.1:9000`; its console is on `127.0.0.1:9002`. Testcontainers should allocate isolated dynamic test ports and override every `TEST_*` endpoint at runtime.

## Database index synchronization and validation

MongoDB does not use SQL-style migrations here. Schema evolution uses reviewed, idempotent index scripts plus explicit versioned backfills. Local index synchronization is safe only against the local development URI in `.env`.

```powershell
pnpm db:indexes:sync:local
pnpm db:indexes:validate
```

Atlas vector and lexical search definitions require an explicitly configured staging project. The validation command is read-only; index creation or updates require separate operator approval.

```powershell
pnpm db:indexes:validate:atlas
```

When a future schema change needs a data backfill, create a named, versioned script and execute it first in staging with dry-run output. There is deliberately no generic `migrate latest` command that could mutate an unintended database.

## Development processes

Run all three independently scalable applications:

```powershell
pnpm dev
```

Or run them separately in three terminals:

```powershell
pnpm --filter @askpdf/web dev
pnpm --filter @askpdf/api dev
pnpm --filter @askpdf/worker dev
```

Expected local endpoints after implementation:

```text
Web:       http://localhost:5173
API:       http://localhost:4000
Health:    http://localhost:4000/health/live
Readiness: http://localhost:4000/health/ready
MinIO API: http://localhost:9000
MinIO UI:  http://localhost:9002
```

## Static verification and build

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

Apply formatting only to files intentionally changed in the current task:

```powershell
pnpm format
git status --short
git diff --check
```

## Test commands

Fast unit suite:

```powershell
pnpm test:unit
```

Isolated API, worker, Mongo, Redis, and storage integration suite:

```powershell
pnpm test:integration
```

Security, deterministic retrieval evaluation, and load suites:

```powershell
pnpm test:security
pnpm test:evaluation
pnpm test:load
```

Browser installation and end-to-end tests:

```powershell
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Full local quality gate:

```powershell
pnpm verify
```

Package-specific diagnosis:

```powershell
pnpm --filter @askpdf/contracts test:unit
pnpm --filter @askpdf/database test:unit
pnpm --filter @askpdf/api test:integration
pnpm --filter @askpdf/worker test:integration
pnpm --filter @askpdf/web test:unit
```

Atlas hybrid-search validation is intentionally separate because local MongoDB is not a parity substitute:

```powershell
pnpm test:integration:atlas
pnpm test:evaluation:atlas
```

## Production-mode local smoke test

```powershell
pnpm build
pnpm --filter @askpdf/api start
pnpm --filter @askpdf/worker start
pnpm --filter @askpdf/web preview --host 127.0.0.1 --port 4173
```

In another PowerShell terminal:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4000/health/live
Invoke-RestMethod -Method Get -Uri http://localhost:4000/health/ready
```

The authenticated upload-to-answer smoke test must use `scripts/smoke/staging.ps1` after Day 14; it must create its own disposable workspace and delete only objects and records whose IDs it created.

## CI gate order

CI should fail closed in this order so inexpensive failures stop early:

```text
1. Frozen dependency install and lockfile integrity
2. Secret, dependency, license, and static security scans
3. Formatting, lint, and TypeScript checks
4. Unit tests with coverage thresholds
5. Integration and tenant-isolation tests
6. Build and container scan
7. Deterministic retrieval/citation evaluation gates
8. Playwright end-to-end suite
9. Staging Atlas evaluation and deployment smoke tests
```

No production deployment may proceed when a required gate is skipped, unavailable, or below threshold. A documented human waiver must name the gate, owner, expiry, impact, and rollback trigger.

## Deployment order after separate authorization

```text
1. Verify backups, secret references, compatibility, and rollback images.
2. Validate MongoDB indexes and Atlas search definitions without mutation.
3. Apply explicitly approved additive indexes or versioned backfills.
4. Deploy API with backward-compatible contracts and verify readiness.
5. Deploy worker with concurrency initially set to one and observe queues.
6. Increase worker concurrency within provider and database limits.
7. Deploy web and run the authenticated staging smoke suite.
8. Enable traffic gradually while watching errors, latency, cost, and backlog.
```

## Shutdown, cleanup, and rollback

Stop applications with `Ctrl+C` so SIGINT handlers drain HTTP requests and close BullMQ workers before exit. Stop local dependencies without deleting data:

```powershell
docker compose down
```

Deleting local volumes is destructive and is not part of the normal workflow. If the user explicitly approves resetting local development data, first verify that the Compose project points to this repository, then run:

```powershell
docker compose down --volumes
```

Production rollback uses the last known-good immutable web/API/worker images. Roll back stateless services first; pause incompatible workers before rollback; never reverse an additive database change until retention, compatibility, and backup restoration have been verified. Preserve failed jobs and audit records for diagnosis, and replay dead-letter jobs only through the reviewed runbook.
