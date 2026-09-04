# Ask-PDF Test, Security, and Release Plan

## Release principle

Ask-PDF is releasable only when tenant isolation, citation correctness, ingestion integrity, and failure recovery are demonstrated by reproducible tests. Model output is untrusted; prompts are one control among retrieval filters, structured validation, citation checks, evaluation, and abstention.

## Test layers

### Unit tests

- `packages/contracts`: valid/invalid IDs, dates, pagination, error envelopes, DTO projections, queue payloads, progress/answer SSE events, and AI output schemas.
- `packages/config`: every S06 field, production cross-field rules, pairwise secret uniqueness, limits, URL schemes, feature flag dependencies, and safe error rendering.
- `packages/rag`: Unicode/whitespace/line-join normalization, repeated furniture, token-aware chunking, deterministic IDs, page spans, query normalization, cache keys, RRF, deduplication, context budgeting, evidence gating, prompt templates, and citation validation.
- `packages/ai`: provider response validation, model/dimension mismatches, batching, timeout, quota/retry mapping, structured-output failures, and token accounting using interface mocks.
- `packages/storage`: object-key generation, filename sanitization, signed-request constraints, range/stream limits, and provider error mapping.
- `packages/queue`: queue names, payload rejection, deterministic job IDs, priority mapping, retry classification, exponential backoff/jitter bounds, and retention settings.
- UI: reducer/query behavior for every S03 component state, sanitized Markdown, stale/out-of-order SSE, focus, keyboard, and rate-limit countdown with a controlled clock.

Unit tests never call real Gemini, Atlas, Redis, S3, or public URLs.

### API integration tests

Use Supertest with isolated MongoDB/Redis/MinIO Testcontainers where the feature needs them.

- Exact status, headers, cookies, CSRF, request/response schemas, error codes, and cursor behavior for every S02 route.
- For each tenant-owned endpoint: authorized success, unauthenticated, insufficient role, foreign-workspace identifier, deleted resource, malformed identifier, and dependency failure.
- Register atomicity, neutral login errors, disabled users, refresh rotation/reuse/concurrency, logout, secure production cookie flags, and rate-limit `Retry-After`.
- Upload intent/complete/abort: zero byte, too large, false MIME/extension, wrong magic, checksum/length mismatch, expired signed URL/intent, missing object, interrupted upload, repeated/concurrent completion, and same/cross-tenant duplicate.
- Document, collection, conversation, question, citation source, and cursor state conflicts.
- Verify responses never include password hash, storage bucket/key, checksum, embedding, prompt text, raw provider errors, secrets, or stack traces.

### Worker integration tests

- Download is streamed to an isolated job directory and removed on success/failure/cancel/shutdown.
- PDF validation/extraction covers clean text, blank pages, malformed/truncated/encrypted files, renamed non-PDF, rotations, encodings, ligatures, missing spaces, multi-column pages, large tables, repeated headers/footers, mixed/scanned pages, decompression/pathological fixtures, and page/text/time/temp limits.
- Stage/checkpoint updates are monotonic and contain document/run/version/correlation/attempt metadata without raw content.
- Embedding batches respect count, token, and concurrency limits. Partial batch success, rate limits, wrong response length/dimension, timeout, and provider unavailability have typed outcomes.
- Chunk upserts are deterministic and idempotent. A readiness check fails when any expected chunk is missing, incompatible, stale, or not searchable.
- Deletion handles object/chunk/cache/source cleanup, already-missing dependencies, in-flight ingestion, and repeated execution.

### Queue retry, idempotency, and resilience tests

| Scenario                                | Required invariant                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Duplicate ingest delivery               | One processing run/version and one stable chunk set; no duplicate usage accounting.                            |
| Crash after each stage boundary         | Retry resumes/repeats safely and never regresses durable stage/version.                                        |
| Crash during embedding batch            | Stored matching chunks are skipped; only missing/mismatched chunks are embedded.                               |
| Stale worker after reprocess            | Cannot write chunks/status to the new active version or mark it ready.                                         |
| Redis progress key loss                 | Durable status remains; SSE sends MongoDB snapshot and continues after recovery.                               |
| Out-of-order progress                   | Lower version/sequence is rejected by server and client.                                                       |
| Retryable outage                        | Maximum 3 attempts with 2-second exponential base plus jitter; terminal code after exhaustion.                 |
| Deterministic parser/security rejection | No automatic retry until input/configuration/version changes.                                                  |
| Cancellation race                       | Worker checks between pages/batches/stages, releases resources, and records one terminal state.                |
| Graceful shutdown                       | Stops new work, completes/releases active work within 30 seconds, closes clients.                              |
| Dead-letter workflow                    | Exhausted job remains in capped failed set and durable run; authorized manual reprocess creates a new version. |

### Retrieval-quality evaluation

Create immutable, synthetic/public-domain/approved-sanitized fixtures with documents, page maps, questions, expected relevant chunk/page sets, answerability, expected exact terms, conflict labels, and difficulty/category metadata. Split into development and locked release sets to reduce overfitting.

Question categories:

- direct single-page facts;
- exact identifiers, names, dates, formulas, policy/clause codes;
- paraphrases/synonyms;
- multi-page synthesis;
- multi-document comparison;
- conflicting/superseded sources;
- ambiguous questions requiring clarification;
- intentionally unanswerable questions;
- repeated headers/noise/near-duplicate chunks;
- prompt-injection text and mixed-language/unsupported-language cases.

Every report records dataset hash, code commit, model names, embedding dimension, normalization/chunk/prompt/retrieval versions, index names, candidate/context limits, thresholds, cache state, concurrency, and environment.

### Quality metrics and definitions

| Metric                         | Definition                                                                                                                                                                             | Release use / initial target                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Retrieval Hit@K                | Fraction of answerable questions with at least one annotated relevant chunk/page among top K after fusion.                                                                             | Hit@5 >= 90% (**confirmed target**). Also report @1/@10.                                                                           |
| Mean Reciprocal Rank           | Mean reciprocal rank of first annotated relevant result; zero when absent.                                                                                                             | Baseline and non-regression; numeric target set after baseline (**proposed gate**).                                                |
| Citation precision             | Valid cited claim-source pairs that directly support/entail the associated claim divided by all cited pairs. Human double-review or a validated rubric/judge with sampled human audit. | >= 85% (**confirmed target**); no critical wrong-page/foreign-source failures.                                                     |
| Citation coverage              | Factual claims with at least one valid supporting citation divided by all factual claims.                                                                                              | 100% structural coverage; >= 95% entailment coverage on release set (**proposed target**).                                         |
| Answer faithfulness            | Atomic answer claims entailed by cited evidence divided by answer claims, using deterministic claim extraction plus rubric review.                                                     | >= 95% (**proposed target**); report method/inter-rater agreement.                                                                 |
| Unsupported-claim rate         | Unsupported factual claims divided by all factual claims.                                                                                                                              | <= 5% (**proposed target**) and zero cross-tenant claims.                                                                          |
| Correct refusal rate           | Unanswerable/insufficient questions returning `insufficientEvidence` without answer text divided by all annotated unanswerable questions.                                              | >= 90% (**confirmed target**). Report false-refusal rate on answerable set.                                                        |
| Quiz answer-key correctness    | Accepted quiz items whose keyed answer and explanation are entailed by cited pages and whose distractor/ambiguity checks pass.                                                         | >= 98% before quiz release (**proposed V2 target**); ambiguous acceptance <= 1%.                                                   |
| Study-note citation coverage   | Atomic note facts/definitions/formulas with valid source citations divided by all such items.                                                                                          | >= 95% before notes release (**proposed V2 target**).                                                                              |
| Debate-claim evidence coverage | Pro/con/rebuttal factual claims with valid same-side or explicitly qualified evidence divided by all factual debate claims.                                                            | >= 95%; unsupported position generation = 0 in release set (**proposed V2 target**).                                               |
| Ingestion success rate         | Successfully ready eligible documents divided by accepted supported PDFs, segmented by fixture type/size.                                                                              | >= 99% on supported release corpus (**proposed target**); unsupported/encrypted files excluded but rejection correctness reported. |
| P95 query latency              | 95th percentile server time from accepted question to validated terminal answer/refusal, reported cached/uncached separately.                                                          | Cached under 1 second in controlled deployment (**confirmed target**); uncached measured/budgeted after baseline.                  |
| P95 document-processing time   | 95th percentile from verified completion/enqueue to ready/terminal failure, by page/byte/text bands and worker concurrency.                                                            | Measure before commitment; no fixed target until representative staging baseline.                                                  |

Quality gates cannot be relaxed merely to make a model/configuration pass. A threshold change requires a new retrieval/prompt/configuration version, before/after aggregate report, regression analysis, and review.

### Citation correctness evaluation

The deterministic validation pipeline runs before qualitative evaluation:

1. Model output parses against the versioned Zod schema.
2. Each source reference resolves within the exact retrieved candidate set.
3. Workspace, selected document, and ready processing version match the request snapshot.
4. Page number exists in the chunk's source spans.
5. Normalized excerpt is a bounded substring of the cited source/page representation.
6. Every model-emitted factual claim ID is covered by at least one citation; duplicate/unused/unknown claim IDs are rejected.
7. An entailment rubric evaluates whether evidence actually supports the claim; deterministic checks alone do not claim semantic support.
8. Any failure discards the generated answer. No “best effort” citation attachment occurs afterward.

### End-to-end browser tests

- Register/login/logout/refresh and workspace hydration.
- Upload two PDFs directly, cancel/retry one, navigate away, observe activity tray and ready terminal state.
- Create/edit a collection and start a 1-20 document conversation.
- Ask a multi-document question; verify loading/retrieval/generation states, answer/citations, JSON fallback and citation-safe SSE path.
- Click a citation with keyboard and pointer; open correct page, refresh an expired URL once, deny foreign/stale citations.
- Ask an unanswerable question and see the explicit refusal with suggested recovery.
- Exercise failed/cancelled/reprocess/delete states, SSE reconnect/Redis fallback, pagination, and rate-limit countdown.
- Run at 360px and desktop widths, with reduced motion and accessibility checks.
- Inject malicious Markdown/HTML/unsafe URLs and verify safe rendering.

### Load and large-file tests

- Generate or use an approved synthetic 100 MiB/500-page boundary fixture when feasible; separately test one-byte/one-page over limits without requiring a huge committed binary.
- Measure worker RSS, event-loop delay, temp bytes, extraction throughput, embedding concurrency, Mongo bulk-write time, and cleanup.
- Saturate configured worker concurrency (2/process), temp reservations, queue depth, API upload intent/question rates, Gemini mock quotas, and Atlas candidate load.
- Verify backpressure returns bounded 429/503 behavior and does not create unbounded promises, memory, temp files, or connection pools.
- Test cached and uncached concurrent questions, repeated identical questions, 20-document selection, long conversation summaries, and 7,000-token context ceiling.
- Provider-backed load tests are gated, quota-capped, and never target production/customer data.

## Security plan

### Authentication and authorization

- Minimum 12/max 128 password input; Argon2id values from validated configuration.
- Access/refresh/CSRF/cursor secrets are independent >=32-byte values; production rotation procedures are documented.
- Access tokens validate algorithm, issuer, audience, subject, session ID, expiration, active user/session, and intended token type.
- Refresh rotation is single-use; reuse revokes the chain. Session cookies are host-only unless explicitly configured.
- Every tenant resource query includes workspace scope and soft-delete/ready-version predicates as applicable.
- Foreign identifiers do not reveal existence; tests assert the approved 404/403 behavior consistently.

### Tenant-isolation matrix

| Boundary                         | Required isolation test                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Mongo repositories               | Foreign workspace ID in read/list/update/delete returns no row and changes nothing.                                            |
| Atlas vector/lexical             | Pipeline contains workspace/document/version filters; seeded foreign high-score chunk never appears.                           |
| Redis cache/progress/locks/rates | Keys contain environment/workspace; foreign stream/cache hit impossible; no raw question key.                                  |
| Object storage                   | Object key is server generated; signed read/write issued only after current authorization; foreign key input ignored/rejected. |
| BullMQ                           | Worker re-reads document/run by scoped state; payload user/workspace data is not trusted.                                      |
| SSE                              | Subscription and reconnect reauthorize; foreign document/stream receives no event.                                             |
| Citations/PDF pages              | Citation/message/document/version are reauthorized on each open; citation ID is not a capability.                              |
| Deletion/reprocessing            | Role and workspace rechecked; stale/in-flight jobs cannot affect another/newer version.                                        |

### Malicious-PDF tests

- Extension/MIME spoofing and incorrect magic bytes.
- Zero-byte, truncated, malformed, encrypted/password-protected, and parser-crashing samples.
- Excessive pages/text, compressed/pathological resources, giant dimensions/images/tables, recursive/embedded objects where applicable, and timeouts.
- Filenames with traversal, control characters, Unicode confusables, reserved device names, and extreme length.
- PDFs containing JavaScript, launch actions, embedded files, external links, forms, and document instructions; extraction never executes/fetches them.
- Scan before parse when malware scanning is enabled; explicitly configured fail-open/fail-closed behavior, with production default documented.
- Parser/OCR runs in worker with process/container memory/CPU/temp/network restrictions appropriate to the chosen host.

### Prompt-injection tests

- Evidence stating “ignore previous instructions,” requesting secrets/system prompt, demanding URL/tool calls, or claiming another tenant's IDs.
- Evidence that embeds fake source/chunk/page identifiers or JSON delimiters.
- Conflicting instructions across pages/documents, hidden/repeated text, and malicious user questions attempting to override evidence policy.
- Assertions: only retrieved evidence enters context; no secrets/tools/network; schema/citation validator rejects fabricated IDs; raw instructions are treated as quoted data; insufficient evidence is preserved.

### Dependency and secret scanning

- Frozen lockfile and package-manager integrity; dependency review on pull requests.
- Secret scanning across Git history/diff and built web assets; `.env*` policy check.
- Vulnerability audit with severity policy and documented, expiring exceptions.
- License allow/deny review for production dependencies.
- Container base-image scan and SBOM for API/worker images.
- Static checks for dangerous HTML rendering, unscoped repository calls, `process.env` outside config, server packages imported by web, provider SDK imports outside adapters, and forbidden frameworks.

## Required CI quality gates

Run as separate jobs/commands and inspect every exit code:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:rag
pnpm build
pnpm test:e2e                  # required for user-visible flow changes/release
pnpm test:integration:atlas    # required in gated release environment with test credentials
git diff --check
```

Additional release gates: secret scan, dependency/license review, container scan/SBOM, tenant-isolation suite, malicious-PDF suite, prompt-injection/citation suite, migrations/index-plan review, and artifact provenance. A provider/Atlas test that cannot run is explicitly **skipped and release-blocking where the changed behavior depends on it**; it is never called passed.

## Staging validation

1. Deploy immutable web/API/worker artifacts with staging-only secrets and data stores.
2. Confirm HTTPS, CORS allowlist, secure cookies, proxy settings, private bucket policy, signed URL TTLs, Redis BullMQ-safe policy, Atlas vector/lexical index names/dimensions, and health/readiness.
3. Run the complete MVP journey using approved PDFs: two uploads, progress while navigating, multi-document answer, correct-page citations, insufficient-evidence refusal, cache repeat, controlled worker retry, cancellation, and deletion.
4. Run cross-workspace attack checks using two independent users/workspaces across API, search, SSE, cache, citation, and storage.
5. Run dependency fault drills: Gemini, Redis, MongoDB, S3, and Atlas/search unavailable; verify stated degradation and recovery.
6. Execute evaluation against the locked release set and compare with the prior approved baseline.
7. Run representative large-file/concurrency test and record P50/P95/P99, error rate, memory/temp high-water marks, queue depth, token use, and cache hit rate.
8. Verify backup/restore and a scoped reprocessing/index-version rollout on non-production data.
9. Confirm logs/telemetry contain no raw PDF text, full questions/answers, secrets, cookies, signed URLs, or high-cardinality user/document labels.
10. Obtain explicit go/no-go approval with known risks and rollback trigger thresholds.

## Rollback procedure

- Deployments: retain the previous immutable web/API/worker artifact and configuration revision. Roll back runtime units independently only when contracts and schemas remain compatible; otherwise roll back the coordinated set.
- Database: prefer expand/migrate/contract. New fields start optional/defaulted; backfills are bounded, restartable, versioned, and never run automatically at startup. Do not destructively contract until the rollback window closes.
- Atlas indexes/vectors: create a new versioned index/processing version; keep the previous ready version/index until the new one passes evaluation/search visibility. Switch configuration atomically; rollback by restoring prior version/index and cache namespace.
- Prompts/retrieval/cache: increment versions and retain the prior configuration. Roll back by configuration change; versioned cache keys avoid stale mixing.
- Worker: pause intake, allow/release active jobs safely, deploy prior artifact, and retry only idempotent jobs. Stale version guards prevent old workers from overwriting newer runs.
- Object storage: never delete originals as part of a code rollback. Deletion jobs are idempotent and separately audited.
- Security incident: disable affected endpoint/feature flag, revoke/rotate compromised credentials, invalidate sessions if required, and preserve privacy-minimized audit evidence.
- Rollback verification: liveness/readiness, one upload/ingest, one answer/citation/refusal, queue progress, cross-tenant denial, and error-rate/latency checks.

## Production-readiness checklist

### Architecture/data

- [ ] Three runtime applications build and deploy independently; dependencies obey boundaries.
- [ ] MongoDB models/indexes match the approved S01 decision, including resolution of C-05.
- [ ] Atlas vector dimension/filter mappings and lexical analyzers are created and verified.
- [ ] Redis policy is BullMQ-safe; cache/job namespaces and TTLs are correct.
- [ ] Buckets are private, lifecycle/partial-upload cleanup is configured, and credentials are least privilege.
- [ ] Backups, restore test, data retention/deletion, reprocessing, and index migration are documented.

### Security/privacy

- [ ] Production secrets are independent, provider-managed, rotated from development examples, and absent from web bundles/Git/logs.
- [ ] HTTPS, CORS, trusted proxy, secure cookies, CSRF, Helmet, body limits, and rate limits pass staging tests.
- [ ] Tenant-isolation suite passes across DB/search/cache/jobs/SSE/storage/citations/deletion.
- [ ] Malicious-PDF, XSS/Markdown, prompt-injection, auth/session, signed-URL, and dependency security tests pass.
- [ ] No production/customer document is used in fixtures without explicit authorization and sanitization.

### Reliability/performance

- [ ] Duplicate delivery, partial failure, cancellation, stale worker, crash recovery, and dead-letter/manual reprocess pass.
- [ ] Memory, temp, provider concurrency, DB pool, context, and queue backpressure limits are measured under representative load.
- [ ] Graceful shutdown works inside the platform termination window.
- [ ] Dependency outages show safe, actionable errors; no fabricated answer or corrupt state.

### Accuracy/product

- [ ] Locked evaluation meets approved Hit@5, citation precision, and correct-refusal targets with versions recorded.
- [ ] Citation coverage, faithfulness, unsupported-claim rate, MRR, and false-refusal rate have accepted baselines.
- [ ] Every MVP UI state and complete upload-to-citation journey passes E2E/accessibility/360px checks.
- [ ] Answer SSE never exposes unvalidated output and JSON fallback produces the same terminal contract.

### Operations/release

- [ ] Logs, metrics, tracing, alerts, cost/quota dashboards, and runbooks are usable and privacy-minimized.
- [ ] All required CI gates pass; skipped suites and reasons are explicitly approved.
- [ ] Immutable artifacts, environment configuration, migrations/index steps, smoke tests, rollback steps, and owners are recorded.
- [ ] No unsupported accuracy/capacity claim appears in release notes or demo.
