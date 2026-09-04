# ADR-0001: Ask-PDF Implementation Baseline

- Status: Proposed for plan approval
- Date: 2026-09-04
- Decision owners: Project owner and principal engineering role
- Scope: MVP architecture, trust boundaries, deployment units, and major dependencies

## Context

Ask-PDF must process large untrusted PDFs without blocking HTTP, isolate all tenant-owned resources, retrieve both semantic and exact evidence, abstain when evidence is weak, and expose only server-verified page citations. The repository is empty, so the implementation baseline must establish dependency direction, state ownership, retry behavior, and evaluation before feature code is written.

The latest direct request fixes the principal stack and requires independently scalable web, API, and worker applications, as well as SSE for processing and answer responses. Specifications 01-06 add exact data, API, UI, configuration, and non-goal constraints.

## Decision

Adopt a strict TypeScript `pnpm` monorepo with these runtime applications:

- `apps/web`: React, Vite, React Router, TanStack Query, Tailwind CSS, accessible repository-owned components, direct upload orchestration, PDF.js viewing, and SSE consumption.
- `apps/api`: Express, Zod, authentication/authorization, presigned upload orchestration, resource CRUD, hybrid question orchestration, citation-safe response streaming, and health/SSE endpoints.
- `apps/worker`: BullMQ ingestion and deletion processors, page-aware `pdfjs-dist` extraction, normalization, chunking, Gemini embedding, Atlas indexing, progress, cancellation, and cleanup.

Use shared packages for contracts, configuration, database repositories, storage, queue contracts, AI adapters, RAG logic, observability, and test utilities. No package imports an application; applications do not import each other.

State ownership is explicit:

- MongoDB/Mongoose: durable identities, workspaces, documents, processing runs, chunks/vectors, collections, conversations, messages, citations, and audit events.
- S3-compatible private object storage: original PDF binaries and optional derived artifacts.
- Redis: BullMQ, locks, rate limits, transient progress/history, cancellation signals, and bounded caches. It is never the sole copy of business state.
- Gemini through `@google/genai`: embeddings and evidence-grounded structured generation behind repository adapters.
- MongoDB Atlas Vector Search + MongoDB Search: tenant-filtered semantic and lexical retrieval.

Ingestion is always asynchronous. Upload bytes go from browser to object storage. API completion performs only bounded metadata/signature verification and enqueues IDs plus processing/version metadata. Full parsing, OCR decisions, chunking, embedding, and indexing happen in the worker.

Question answering is evidence-first. Authorization and ready versions are resolved on every request; vector and lexical searches contain workspace/document/version filters; candidates are fused, reranked, deduplicated, and bounded; insufficient evidence stops before generation; structured output and citations are validated before persistence/display.

Answer streaming is additive to the completed JSON endpoint. SSE may emit orchestration progress immediately, but raw model tokens remain server-side until structured output and citations validate. The API then emits citation-safe answer/citation events followed by the persisted terminal message. This intentionally favors correctness over token-by-token immediacy.

## Important alternatives considered

| Alternative                                            | Decision              | Reason                                                                                                                         |
| ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Synchronous upload/parse/embed endpoint                | Rejected              | Violates responsiveness, bounded-resource, and retry requirements.                                                             |
| Store PDFs in MongoDB/GridFS, Redis, or queue payloads | Rejected              | Blurs state ownership, increases memory/replication cost, and violates the supplied storage contract.                          |
| Managed Gemini File Search                             | Rejected for core MVP | Hides the required custom chunking, Atlas retrieval, queue, progress, tenant filters, and evaluation work.                     |
| LangChain/LlamaIndex                                   | Rejected              | Adds opaque orchestration without a demonstrated need and conflicts with explicit non-goals.                                   |
| Vector-only search                                     | Rejected              | Weak for exact identifiers, codes, formulas, names, and clauses.                                                               |
| PostgreSQL/pgvector or Elasticsearch                   | Rejected              | Adds/replaces an unapproved primary/search system; MongoDB Atlas is the selected durable/search platform.                      |
| WebSockets for progress                                | Rejected              | One-way authorized progress is adequately served by SSE.                                                                       |
| Raw token streaming                                    | Rejected for MVP      | Tokens could expose unsupported claims before citation validation. Citation-safe post-validation deltas are selected.          |
| One service or many domain microservices               | Rejected              | One service couples long jobs to HTTP; many services add unnecessary operations. Three runtime units match scaling boundaries. |
| Cross-tenant binary deduplication                      | Rejected              | Risks existence disclosure and ownership coupling. Workspace-scoped duplicate handling is selected.                            |

## Rationale

- The separation matches latency and failure domains: web delivery, short-lived API work, and resource-intensive worker work scale independently.
- Adapter boundaries keep provider SDKs out of domain/application logic and make deterministic testing possible.
- Versioned chunks, models, prompts, retrieval configuration, and cache keys make reprocessing and evaluation reproducible.
- Hybrid retrieval plus a hard evidence/citation validation pipeline directly addresses the product trust goal.
- MongoDB as durable truth and Redis as transient infrastructure permits graceful Redis loss without corrupting document state.

## Consequences

### Positive

- Large-file work cannot block API processes.
- Tenant scope can be enforced systematically through repositories, search filters, cache namespaces, storage authorization, and job revalidation.
- Worker crashes and duplicate delivery are recoverable through deterministic IDs, checkpoints, upserts, and version guards.
- The RAG pipeline remains inspectable and measurable.
- The application can scale API and worker capacity separately.

### Costs and constraints

- Local development needs MongoDB, Redis, and MinIO; production additionally needs Atlas search indexes and Gemini credentials.
- Atlas search behavior cannot be fully reproduced by basic containerized MongoDB, so retrieval needs deterministic unit tests plus gated Atlas integration tests.
- Citation-safe answer streaming provides fewer early tokens than raw model streaming.
- Mongoose transactions require an appropriate replica-set/Atlas configuration for atomic multi-record flows; compensation logic is still required around queue/object operations.
- Version/index changes require coordinated reprocessing rather than silent in-place mixing.

## Security implications

- All tenant-owned repository methods require `workspaceId`; generic tenant-owned `findById` operations are prohibited.
- Search filters must be inside both vector and lexical queries. Post-filtering is not authorization.
- Signed URLs are private, short-lived, one-object/action grants created only after authorization.
- Upload metadata, magic bytes, parser behavior, PDF text, queue payloads, model output, and SSE events are untrusted and validated.
- Generation has no arbitrary tools/network/filesystem/database/secrets and receives only delimited authorized evidence.
- Cookies require secure production settings, explicit CORS, CSRF validation, rotation/reuse detection, and log redaction.

## Scalability implications

- Horizontal worker scaling is controlled by queue concurrency, memory/disk reservations, provider quotas, and backpressure.
- API instances remain stateless apart from external stores; SSE reconnect uses versioned IDs and durable fallback.
- Page batches, embedding batches, bulk writes, retrieval candidates, context tokens, and payload sizes are configurable and bounded.
- Redis queue/cache eviction policies must not evict BullMQ keys; production may need separate logical/physical Redis instances if measured pressure justifies it without changing the abstraction.

## Conditions for revisiting

Revisit this decision only with measured evidence and a new ADR when one or more of these conditions occurs:

- Atlas search cannot meet evaluated relevance, tenancy, latency, or cost requirements.
- Gemini model/version constraints require a different provider adapter or vector dimension/index migration.
- Bidirectional real-time collaboration becomes approved scope, justifying WebSockets.
- OCR/multimodal usage becomes material enough to require a dedicated processing service or GPU runtime.
- Queue/cache contention demonstrates the need for isolated Redis deployments.
- Regulatory or customer requirements demand a different authentication, encryption, residency, deletion, or audit design.
- Sustained measured load justifies Kubernetes, autoscaling, or additional service boundaries.
