# Ask-PDF Project Understanding

## Document status

- Planning baseline only; no application code has been implemented.
- The supplied engineering contract exists as `C:\Users\ASUS\Downloads\AGENTS(1).md`; there is no repository-root `AGENTS.md` yet. Phase 0 must copy/adopt it verbatim before application edits, then nested contracts can be added only when needed.
- Prepared from the latest direct request, `AGENTS(1).md`, Specifications 01-06, and the architecture/technology overview.
- Authority order used: latest direct instruction > `AGENTS(1).md` > numbered specifications > architecture overview > implementation.
- Any value marked **confirmed** comes from an authoritative supplied source. Any value marked **proposed default** is a planning recommendation that remains configurable.

## Product purpose

Ask-PDF is a citation-first, multi-user RAG web application. It lets authenticated users upload PDFs directly to private object storage, observe asynchronous ingestion, organize ready documents into collections, ask questions across one or more authorized document versions, and verify factual answers against exact PDF pages. Its differentiator is the reliable system around Gemini: tenant isolation, retry-safe processing, hybrid retrieval, explicit abstention, validated citations, and measurable quality.

## Intended user groups

- Primary: students and researchers studying one or more source PDFs.
- Secondary: individual professionals reviewing technical, policy, legal, or operational documents.
- Supported tenancy model: a user has a personal workspace at registration and may belong to additional workspaces. Invitation/administration UI is deferred, but server-side membership and roles are part of the MVP security boundary.
- Operational users: developers/operators who need job, dependency, quality, and cost telemetry. Administrative dashboards are deferred; logs, metrics, and run records are MVP infrastructure.

## Primary user problems

1. Large PDFs cannot be safely parsed and embedded within an interactive HTTP request.
2. Generic LLM answers are difficult to trust without page-level evidence.
3. Exact identifiers, formulas, names, dates, and clauses are often missed by vector-only search.
4. Multi-user systems can leak documents through database queries, search, caches, signed URLs, jobs, or progress streams unless tenant scope is enforced at every boundary.
5. Provider failures, duplicate queue delivery, and worker crashes can create corrupt or duplicate indexes without versioning and idempotency.
6. Users need explicit progress, recoverable errors, cancellation, and safe refusal rather than indefinite loading or fabricated answers.

## End-to-end user journey

1. A visitor registers or logs in using secure cookie-based authentication and enters an authorized workspace.
2. The user selects one or more PDFs. The browser performs preliminary checks and computes/provides a SHA-256 digest.
3. For each file, the client requests a short-lived upload intent and uploads directly to a private S3-compatible object using the signed URL.
4. The client confirms the upload. The API reauthorizes the intent, verifies storage metadata and PDF signature through bounded reads, detects duplicates, creates durable metadata/processing records, and enqueues an ID-only BullMQ job.
5. A separate worker streams the object to bounded temporary storage, validates it, extracts text page-by-page with `pdfjs-dist`, normalizes it, creates deterministic token-aware chunks, embeds them in bounded Gemini batches, bulk-upserts them, and marks the document ready only after completeness checks.
6. The UI remains navigable and receives authorized, versioned progress over SSE. It can fall back to the durable MongoDB snapshot when Redis history is unavailable.
7. The user selects 1-20 ready documents, directly or through a collection, and starts a conversation.
8. For every question the API re-resolves authorization and ready processing versions, executes tenant-filtered vector and lexical search, fuses/reranks/deduplicates candidates, applies an evidence-sufficiency gate, and invokes Gemini only with bounded authorized evidence.
9. Structured model output is validated; citations are checked against retrieved chunks and page spans before any answer is persisted or shown. Low evidence returns `insufficientEvidence`.
10. A citation opens a newly authorized, short-lived source URL at the verified page and shows the supporting excerpt.

## Confirmed functional requirements

### Identity and authorization

- Registration, login, refresh rotation, logout, and current-session lookup.
- Argon2id password hashing; short-lived signed access token; opaque refresh token stored only as a hash; refresh reuse detection and chain revocation.
- Secure, HttpOnly, SameSite cookies and CSRF protection for cookie-authenticated mutations.
- Personal workspace creation during registration; workspace membership and roles (`owner`, `admin`, `member`, `viewer`).
- Server-side authorization for every document, collection, conversation, citation, PDF source, SSE stream, cache entry, and job transition.

### Documents and ingestion

- Multi-file drag/drop upload, per-file progress, cancellation, retry, and explicit rejection states.
- Direct-to-private-object-storage signed uploads; no PDF bytes in API JSON, Redis, MongoDB documents, or BullMQ payloads.
- Verified size, checksum metadata, magic bytes, page count, and configured resource limits.
- Workspace-scoped SHA-256 duplicate detection; completion and reprocessing are idempotent.
- Separate API and worker runtimes; asynchronous BullMQ ingestion with deterministic job IDs and processing versions.
- Page-aware extraction, normalization, repeated-header/footer handling, scanned-page detection, deterministic token-aware overlapping chunks, batched embeddings, bulk upsert, and readiness completeness checks.
- Rename, list/search/filter/paginate, view, delete/purge, reprocess, cancel, and inspect progress.

### Retrieval, generation, and citations

- Questions across one or several authorized ready PDFs.
- Atlas Vector Search plus MongoDB Search with workspace, document, and processing-version filters inside each search query.
- Reciprocal-rank-style fusion, overlap deduplication, bounded reranking/context selection, and an evaluated evidence threshold.
- Prompt-injection-resistant, versioned prompts that treat PDF content as untrusted evidence.
- Zod-validated structured Gemini output; unknown, unauthorized, unretrieved, or wrong-page citations fail validation.
- Every user-visible factual claim is linked to at least one verified citation; unsupported questions return an explicit refusal.
- Conversation creation/history/rename/archive/delete and bounded prior context.
- Status streaming and, per the latest direct instruction, answer-response streaming over SSE with a citation-safe validation gate.

### Frontend

- Public landing, login, and registration routes.
- Authenticated document library/detail, collection list/detail, conversation list/new/chat, and profile/workspace settings routes.
- Explicit loading, success, empty, partial, retry, cancellation, dependency failure, rate-limit, and terminal failure states.
- Accessible citation controls, focus management, keyboard operation, reduced-motion support, minimum 44px targets, and responsive behavior to 360px.
- Sanitized allow-listed Markdown only; no raw model HTML.

### Operations and quality

- Pino structured logging, correlation IDs, redaction, health/readiness probes, bounded metrics labels, queue/dependency/provider telemetry, and graceful shutdown.
- Unit, API, worker, integration, browser, security, load/resource, and reproducible RAG evaluation suites.
- Independently deployable/scalable `web`, `api`, and `worker` applications.

## Confirmed non-functional requirements

- Type safety: strict TypeScript, no unchecked untrusted input, Zod at every external boundary.
- Security: fail closed in production, least-privilege signed URLs, tenant scoping in predicates/search/cache/storage, CSRF/CORS/cookie hardening, malicious PDF and prompt-injection controls.
- Reliability: at-least-once delivery assumed; deterministic IDs; version checks; idempotent upserts; checkpoints; bounded retries; cooperative cancellation; durable terminal state.
- Performance: API never performs PDF extraction/embedding; streaming or page-batched processing; bounded memory, temporary disk, provider concurrency, context, and bulk writes; backpressure and quotas.
- Privacy: raw document text, full questions/answers, secrets, signed URLs, tokens, and PII are not logged by default; customer documents are not test fixtures without explicit authorization.
- Accuracy: evidence-first generation, page mapping, hybrid retrieval, citation-to-chunk validation, correct refusal, version tracking, and measured evaluation rather than unsupported claims.
- Maintainability: three runtimes with shared packages, one adapter per external provider class, thin routes, repository-scoped persistence, browser-safe contracts, and no circular/cross-app imports.

## MVP scope

- Repository/tooling and local MongoDB, Redis, and MinIO infrastructure.
- Validated process configuration and shared contracts.
- Data models, indexes, scoped repositories, auth sessions, personal workspaces, and role enforcement.
- Direct PDF upload, duplicate detection, asynchronous ingestion, cancellation/reprocess/delete, durable and streamed progress.
- Text-layer PDF extraction and scanned/low-text detection. An OCR adapter seam is included; OCR execution remains off by default.
- Versioned chunking/embedding and Atlas index readiness.
- Collections, 1-20 document conversations, hybrid retrieval, grounded generation, refusal, citation persistence, and authorized source viewing.
- Core responsive frontend and all specified states.
- Citation-safe SSE answer events as required by the latest direct instruction; unvalidated provider tokens are never sent to the browser.
- Security hardening, evaluation, observability, CI/CD readiness, and deployment/rollback documentation.

## Deferred scope

- Quiz, study-note, debate, flashcard, practice-exam, tutoring, concept-map, timeline, comparison, contradiction, game, progress-tracking, collaboration, and instructor workflows; see `05-v2-learning-features.md`.
- Full OCR by default, multimodal figure/chart understanding, source-region highlighting, and learned reranking.
- Managed Gemini File Search, LangChain/LlamaIndex, model training/fine-tuning, or custom model hosting.
- Public sharing/marketplace/search indexing, billing, native mobile/offline, voice/bots/extensions, real-time collaborative editing, Kubernetes/service mesh, and extra primary stores/queues.
- Workspace invitations, administrative audit UI, queue dashboard, verified-answer workflow, and streaming raw model tokens.

## Assumptions and recommended defaults

| ID   | Assumption / default                                                                                                                                       | Rationale                                                                   | Approval needed before Phase 0?      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| A-01 | Start with personal workspaces and full server-side role/membership models; hide invitations and role mutation UI.                                         | Reconciles mandatory tenancy models with deferred collaboration UI.         | No.                                  |
| A-02 | Keep OCR adapter/contracts and low-text detection in MVP; leave `FEATURE_OCR=false` and reject/flag scanned-only content with a stable explanation.        | Matches the non-goal and environment specification.                         | No.                                  |
| A-03 | Implement answer SSE as progress plus post-validation answer/citation deltas; buffer untrusted model output until validation.                              | Satisfies direct streaming requirement without exposing unsupported claims. | No; latest instruction controls.     |
| A-04 | Keep the existing `POST .../questions` JSON contract as fallback and add an additive streaming endpoint during contract foundation.                        | Avoids breaking the numbered API while enabling the required UX.            | No, unless only one mode is desired. |
| A-05 | Duplicate detection is workspace-scoped and returns the existing active document rather than deduplicating binaries across tenants.                        | Prevents cross-tenant existence disclosure.                                 | No.                                  |
| A-06 | A ready index remains queryable while a newer reprocess run builds; conversations resolve the ready version at question time and disclose version changes. | Preserves availability without letting stale workers overwrite new state.   | No.                                  |
| A-07 | No separate DLQ service in MVP: capped BullMQ failed-job retention plus durable failed `DocumentProcessingRun` records form the dead-letter workflow.      | Meets audit/retry needs with fewer moving parts.                            | No.                                  |
| A-08 | Deployment provider remains selectable among the documented Vercel + Render/Railway + Atlas + Redis Cloud + S3/R2 options.                                 | No production provider was selected.                                        | Yes, before deployment work only.    |

## Contradictions and unresolved questions

| ID   | Exact conflict                                                                                                                                                                                                                                    | Affected work                                                 | Choices                                                                                                                                     | Recommendation and consequence                                                                                                                                                                                                             | Approval status                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| C-01 | Latest instruction requires SSE for status **and response streaming** and roadmap item 11; Spec 05 defers “streaming answer tokens,” and Spec 06 sets `FEATURE_STREAMING_ANSWERS=false`; Spec 02 defines only a completed JSON question response. | Contracts, API question orchestration, web chat state, tests. | (A) MVP citation-safe SSE; (B) defer all answer streaming; (C) stream raw provider tokens.                                                  | Choose A. Add an endpoint without removing the JSON fallback; buffer/validate model output before answer deltas. Slight latency/complexity increase; preserves citation invariant. C is rejected. Latest direct instruction resolves this. | No further approval required for A.            |
| C-02 | Architecture overview lists shared workspace collaboration as v2, while Specs 01-03 require multi-workspace membership/roles and workspace settings in the MVP.                                                                                   | Auth/data model/UI.                                           | (A) personal workspace UI with complete membership enforcement; (B) implement invitations/admin membership UI; (C) remove membership model. | Choose A. Security model remains future-ready, invitation/role mutation UI stays deferred.                                                                                                                                                 | No.                                            |
| C-03 | UI flow names an `ocr` progress stage “when needed,” but Spec 05 defers selective OCR and Spec 06 disables OCR.                                                                                                                                   | Worker stages and UI labels.                                  | (A) detect and report OCR-needed while adapter disabled; (B) ship OCR provider in MVP; (C) remove stage.                                    | Choose A. Retain enum/adapter seam; do not run OCR unless scope is later approved and configured.                                                                                                                                          | No.                                            |
| C-04 | User requires ADR at `docs/decisions/`, while `AGENTS(1).md` describes the target ADR folder as `docs/adr/`.                                                                                                                                      | Documentation paths.                                          | Use requested path, duplicate, or move.                                                                                                     | Use the exact user-requested `docs/decisions/` path and avoid divergent duplicates.                                                                                                                                                        | No; direct instruction controls.               |
| C-05 | `DocumentProcessingRun.promptVersion` is required in Spec 01 even though ingestion does not use an answer prompt.                                                                                                                                 | Schema and reprocessing metadata.                             | (A) keep required; (B) make nullable/remove; (C) rename to pipeline configuration snapshot.                                                 | Recommend C: replace with a structured/versioned processing configuration snapshot or make `promptVersion` non-ingestion metadata. Current field couples unrelated lifecycles.                                                             | **Yes, before Phase 2 schema implementation.** |
| C-06 | Spec 02 says upload completion verifies magic bytes before document creation, while Spec 04 also requires worker revalidation and `pdfjs-dist` validation.                                                                                        | Upload completion and worker.                                 | Verify minimally twice or defer all validation to worker.                                                                                   | Verify bounded signature/metadata in API, fully parse/page-count only in worker. This is complementary, not duplicated full parsing.                                                                                                       | No.                                            |

## Initial configurable limits

| Limit                         |                                             Value | Status           | Notes                                                                                                   |
| ----------------------------- | ------------------------------------------------: | ---------------- | ------------------------------------------------------------------------------------------------------- |
| Maximum upload                |                       104,857,600 bytes (100 MiB) | Confirmed        | API/client declaration plus storage and worker verification.                                            |
| Maximum pages                 |                                               500 | Confirmed        | Worker-enforced after opening document.                                                                 |
| Worker concurrency            |                                     2 per process | Confirmed        | Scale process count independently; revisit after memory/load tests.                                     |
| Extraction page batch         |                                          10 pages | Confirmed        | Pages still processed incrementally; release page resources after each batch.                           |
| Embedding batch               |                          32 chunks, concurrency 2 | Confirmed        | Also cap by token budget and provider quota.                                                            |
| Retrieval candidates          |                20 vector + 20 lexical; fuse to 20 | Confirmed        | Deduplicate/rerank to at most 8 final chunks.                                                           |
| Maximum generation context    |                            7,000 tokens; 8 chunks | Confirmed        | Token count is authoritative, chunk count is a second bound.                                            |
| Conversation source selection |                                      20 documents | Confirmed        | All must resolve to authorized ready versions.                                                          |
| Job retry                     | 3 attempts; 2,000 ms exponential base plus jitter | Confirmed        | Non-retryable input/parser/security errors terminate immediately.                                       |
| Question rate                 |                  10/minute burst and 60/hour/user | Confirmed        | Also workspace/provider quota controls.                                                                 |
| Upload intents                |                                      20/hour/user | Confirmed        | Plus 200 ready documents and 1 GiB/workspace quota.                                                     |
| Login/register                |        10/15 min account+IP; 5 registrations/hour | Confirmed        | Return `Retry-After`.                                                                                   |
| Progress TTL                  |                                    86,400 seconds | Confirmed        | Durable terminal state remains in MongoDB.                                                              |
| Validated answer TTL          |                                     3,600 seconds | Confirmed        | Versioned, tenant-scoped key.                                                                           |
| Query embedding TTL           |                                    86,400 seconds | Confirmed        | Versioned by embedding model/configuration.                                                             |
| Signed upload/read URLs       |                                   900/600 seconds | Confirmed        | One object/action, generated after authorization.                                                       |
| Maximum temporary bytes/job   |                                 157,286,400 bytes | Confirmed        | Reservation must succeed before download; cleanup in `finally`.                                         |
| Queue priority                |     retry=1, new upload=5, maintenance reindex=10 | Proposed default | Lower numeric value is treated as higher priority after confirmation against the pinned BullMQ version. |

## Definition of project success

### Product success

- A new user can register, upload multiple PDFs directly, navigate while processing continues, ask a multi-document question, open every citation on the correct authorized page, and receive a clear refusal for an unanswerable question.
- Failures are actionable: uploads, worker stages, question generation, SSE reconnects, and citations have durable recovery paths.

### Security and integrity success

- Cross-workspace access fails closed in API, repositories, Atlas filters, Redis keys, object access, SSE, citations, deletion, and cache tests.
- Duplicate delivery, partial embedding failure, stale workers, cancellation, and retry do not duplicate chunks or incorrectly mark a document ready.
- No secret, raw PDF, full question/answer, signed URL, or embedding is exposed through client DTOs or default logs.

### Quality and reliability success

- Retrieval Hit@5 >= 90% and absent-answer correct refusal >= 90% on the approved internal evaluation set (**confirmed acceptance targets**).
- Citation precision >= 85% (**confirmed acceptance target**), with citation coverage, faithfulness, unsupported-claim rate, MRR, latency, and processing percentiles reported rather than guessed.
- All mandatory CI gates pass; provider/Atlas suites that cannot run are clearly reported as skipped, never as passed.
