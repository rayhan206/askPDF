# Ask-PDF Strictly Ordered Implementation Backlog

## Usage

- Status: planning only; every item is unstarted.
- Execute in numeric order. Stop at each approval gate. A task includes its adjacent tests and documentation in the same focused change.
- Do not start an item whose prerequisite/phase exit criterion is not green. Parallel execution requires the explicit safe-parallel rules in `docs/03-implementation-roadmap.md` and must not reorder shared contracts.

## Phase 0 - Repository and developer tooling

0. **B000 / P0-00 - Repository engineering contract:** after Phase 0 approval, copy the supplied `AGENTS(1).md` to root `AGENTS.md` verbatim, compare hashes/bytes, and read it from its repository location before every later task.
1. **B001 / P0-01 - Root package manifest:** add private `package.json` with the exact AGENTS root scripts and pinned package-manager/engine fields. Validate JSON and `pnpm --version` resolution.
2. **B002 / P0-01 - Workspace declaration:** add `pnpm-workspace.yaml` for `apps/*` and `packages/*`; verify workspace discovery.
3. **B003 / P0-01 - Strict TypeScript base:** add root strict compiler configuration/project-reference conventions; include a compile-failure fixture for unsafe typing.
4. **B004 / P0-02 - App package shells:** add manifests/directories for `@askpdf/web`, `@askpdf/api`, and `@askpdf/worker` with independent build/typecheck scripts.
5. **B005 / P0-02 - Shared package shells:** add browser-safe public entry points/manifests for contracts, config, database, storage, queue, AI, RAG, observability, and test-utils.
6. **B006 / P0-03 - Prettier:** configure formatting and `format:check`; prove an intentionally malformed fixture fails, then remove the fixture.
7. **B007 / P0-03 - ESLint strict rules:** configure TypeScript/React rules, promise safety, and forbidden `any`/`@ts-ignore`; run lint.
8. **B008 / P0-03 - Import boundaries:** enforce no package->app, app->sibling-app, server->web, deep cross-package, or circular imports; add boundary tests.
9. **B009 / P0-03 - Vitest projects:** create unit test projects and one smoke test per workspace; run `pnpm test:unit`.
10. **B010 / P0-04 - MongoDB local service:** add pinned replica-set MongoDB service/health/init needed for transactions; verify health without application data.
11. **B011 / P0-04 - Redis local service:** add pinned authenticated Redis service/health; verify BullMQ-compatible policy.
12. **B012 / P0-04 - MinIO local service:** add pinned MinIO service/private test buckets/health; verify no public policy.
13. **B013 / P0-05 - API liveness shell:** implement `GET /health/live` and Supertest contract.
14. **B014 / P0-05 - Worker shutdown shell:** implement bounded signal shutdown with a unit/smoke test.
15. **B015 / P0-06 - Baseline CI:** add frozen install, format, lint, typecheck, unit, and build jobs; document intentionally deferred infrastructure jobs.
16. **APPROVAL GATE 0:** report files/commands/results and stop unless the user approved subsequent phases.

## Phase 1 - Environment, contracts, errors, and observability primitives

17. **B016 / P1-01 - Config primitive schemas:** implement boolean, positive integer, duration, byte, URL, and trimmed-list parsers with unit tests.
18. **B017 / P1-02 - Shared/API config:** encode shared identity, API/origin, MongoDB, Redis, storage, auth, Gemini-generation, retrieval, and observability ownership; test missing/invalid values.
19. **B018 / P1-02 - Worker config:** encode MongoDB/Redis/storage/Gemini-embedding/processing/OCR/resource settings and cross-field tests.
20. **B019 / P1-02 - Web config:** expose only approved `VITE_*` values; add build-output secret-name/value scan.
21. **B020 / P1-02 - Production cross-field rules:** require HTTPS/secure cookies/no auto-index/distinct secrets/TLS-capable URIs and test every failure.
22. **B021 / P1-02 - `.env.example`:** copy the approved S06 variable set with safe mock values/comments and validate it through all process schemas.
23. **B022 / P1-03 - Identifier/date schemas:** implement ObjectId, ISO UTC date, UUID client request ID, and bounded string schemas with negative cases.
24. **B023 / P1-03 - Error contract:** implement stable error codes/envelope and serialization tests excluding causes/stacks/secrets.
25. **B024 / P1-03 - Pagination contract:** implement limits and signed opaque cursor payload schema; test tamper/expiry/version cases.
26. **B025 / P1-04 - Identity DTOs:** implement User/Workspace/Member DTOs independently from Mongoose; test forbidden field absence.
27. **B026 / P1-04 - Upload/document DTOs:** implement intent/document/processing/failure schemas from S02; test examples.
28. **B027 / P1-04 - Collection DTOs:** implement collection/list/detail schemas and cursor envelope tests.
29. **B028 / P1-04 - Conversation/message/citation DTOs:** implement schemas and examples, including insufficient-evidence variant.
30. **B029 / P1-05 - Ingest/delete job schemas:** encode IDs/versions/reason/correlation only and prove document text/binary fields reject.
31. **B030 / P1-05 - Progress event schema:** encode version/sequence/stage/percent/time and monotonic comparison helper tests.
32. **B031 / P1-05 - Answer SSE schemas:** encode orchestration progress, validated answer delta, citations, refusal, failure, and terminal events; prove no raw provider event fits.
33. **B032 / P1-06 - Correlation middleware:** accept/validate/generate/return request IDs; add Supertest cases.
34. **B033 / P1-06 - Pino factory/redaction:** redact cookies, auth, questions, answers, URLs, secrets, PDF text; test captured logs.
35. **B034 / P1-06 - Typed error middleware:** map domain/application/dependency errors to S02 envelopes; test unexpected-cause retention internally and client sanitization.
36. **APPROVAL GATE 1:** run contract/config/API filtered lint, typecheck, and unit tests; report and stop as required.

## Phase 2 - MongoDB and Redis foundations

37. **B035 / P2-01 - Mongo lifecycle:** implement bounded connect/close/configuration and integration test shutdown/timeouts.
38. **B036 / P2-01 - Model base conventions:** strict throw, timestamps, optimistic concurrency, soft-delete helpers without network hooks; unit test.
39. **B037 / P2-02 - User model/indexes:** implement exact S01 fields/projections/collation and index test.
40. **B038 / P2-02 - Workspace/Member models:** implement owner invariant and unique membership indexes with integration tests.
41. **B039 / P2-02 - AuthSession model:** implement hidden refresh hash, TTL/rotation fields/indexes; test expiry/index declarations.
42. **B040 / P2-02 - AuditEvent model:** implement append-only allow-listed metadata and reject update/delete service operations.
43. **B041 / P2-03 - UploadIntent model:** implement states/TTL/object-key uniqueness and transition tests.
44. **B042 / P2-03 - Document model:** implement metadata, hidden storage/hash, versions/statuses/indexes and readiness transition tests.
45. **B043 / P2-03 - Resolve C-05:** obtain owner decision, then implement processing configuration snapshot/prompt-version disposition in the approved schema.
46. **B044 / P2-03 - ProcessingRun model:** implement deterministic job/version uniqueness, monotonic stage, checkpoints/cancel/error fields and tests.
47. **B045 / P2-03 - DocumentChunk model:** implement source spans/headings/tokens/hidden embedding/model/dimension/hash/index declarations and validation tests.
48. **B046 / P2-04 - DocumentCollection model:** implement active-name uniqueness, membership array constraints, and soft deletion tests.
49. **B047 / P2-04 - Conversation model:** implement immutable source selection/snapshot/summary bounds/cursor indexes and tests.
50. **B048 / P2-04 - Message model:** implement idempotent reply/client-request support, version/usage metadata, and indexes with tests.
51. **B049 / P2-04 - Citation model:** implement claim/source/page/excerpt/version fields and uniqueness tests.
52. **B050 / P2-05 - Tenant repository base policy:** create explicit workspace-scoped command types and a compile/runtime test preventing generic tenant `findById`.
53. **B051 / P2-05 - Identity/workspace/session repositories:** implement minimal projections and positive/foreign/concurrency tests.
54. **B052 / P2-05 - Upload/document/run/chunk repositories:** implement scoped queries/upserts/version guards/projections with cross-workspace tests.
55. **B053 / P2-05 - Collection/conversation/message/citation repositories:** implement scoped CRUD/cursors/soft-delete filters with cross-workspace tests.
56. **B054 / P2-06 - Redis lifecycle/key builder:** implement namespaced hashed tenant keys and connection close; snapshot tests.
57. **B055 / P2-06 - Redis progress/lock/cache/rate interfaces:** add bounded payload/TTL adapters and failure-mapping integration tests.
58. **B056 / P2-03 - Atlas index documentation/script:** add exact vector/lexical JSON, dimension/version checks, local/test-only sync policy, and gated validation command.
59. **APPROVAL GATE 2:** run database/Redis unit and Testcontainers suites; report index suites skipped/passed precisely.

## Phase 3 - Authentication and tenant authorization

60. **B057 / P3-01 - Argon2id password service:** implement configurable hash/verify and password bounds; test invalid hash and projection safety.
61. **B058 / P3-01 - Access token service:** implement fixed algorithm/issuer/audience/subject/session/type/expiry validation; test confusion/tamper/expiry.
62. **B059 / P3-01 - Opaque refresh token service:** generate token, store SHA-256+pepper hash, timing-safe compare; test entropy/format without logging token.
63. **B060 / P3-02 - Session creation/rotation:** implement single-use transactional rotation and replacement pointer; concurrency tests.
64. **B061 / P3-02 - Reuse detection/revocation:** revoke replacement chain on replay and test forced logout behavior.
65. **B062 / P3-03 - Register service/route:** atomically create user/personal workspace/owner membership/session; exact 201/409/error tests.
66. **B063 / P3-03 - Login service/route:** neutral invalid credentials, disabled user, rate behavior, last-login update; exact tests.
67. **B064 / P3-03 - Refresh route:** rotate cookies/CSRF, reuse/expiry/disabled behavior; exact tests.
68. **B065 / P3-03 - Logout/me routes:** revoke/clear cookies and return memberships; exact tests.
69. **B066 / P3-04 - Authentication middleware:** validate access+active session/user and sanitized 401/403 behavior.
70. **B067 / P3-04 - Session-bound CSRF:** implement token/header check for all mutations with exempt-route tests.
71. **B068 / P3-04 - Workspace role authorization:** server membership lookup and reusable role policy; full role/foreign-ID tests.
72. **B069 / P3-05 - Auth rate limits/audit:** implement S06 windows, privacy-reduced keys, `Retry-After`, safe audit metadata; Redis-outage tests.
73. **APPROVAL GATE 3:** run auth unit/integration/security checks and stop/report.

## Phase 4 - Private storage and direct upload

74. **B070 / P4-01 - Storage interface/errors:** define signed upload/read, HEAD, bounded stream/range, delete, abort operations and contract tests.
75. **B071 / P4-01 - MinIO/S3 adapter:** implement timeouts/private URLs/random keys/metadata and MinIO integration tests.
76. **B072 / P4-02 - Filename/object-key helpers:** sanitize display names and generate random tenant-safe keys; traversal/confusable/reserved-name tests.
77. **B073 / P4-02 - Upload quota/duplicate lookup policy:** implement workspace byte/count and same-workspace hash checks without foreign disclosure.
78. **B074 / P4-02 - Upload intent endpoint:** validate filename/size/hash/MIME/role and return exact signed PUT contract; Supertest/MinIO tests.
79. **B075 / P4-03 - Completion bounded verifier:** HEAD length/checksum and bounded `%PDF-` read; spoof/missing/truncated tests.
80. **B076 / P4-03 - Idempotent completion transaction:** create one Document/Run, handle same intent/duplicate/concurrency; integration tests.
81. **B077 / P4-03 - Enqueue compensation:** enqueue deterministic ID-only job after DB write and compensate/retry safely on queue failure; fault tests.
82. **B078 / P4-04 - Upload abort:** state transition and best-effort multipart/object cleanup; repeated/completed/error tests.
83. **B079 / P4-05 - Web upload state machine:** implement per-file precheck/hash/intent/PUT/complete/cancel/retry reducer and unit tests.
84. **B080 / P4-05 - UploadDropzone/activity UI:** accessible multiple-file controls, per-file progress/errors/limits; component tests.
85. **B081 / P4-05 - Direct-upload E2E:** prove PDF bytes bypass API and cancellation/retry works against MinIO.
86. **APPROVAL GATE 4:** run storage/upload/API/web validations and stop/report.

## Phase 5 - BullMQ, worker shell, progress, retry, and cancellation

87. **B082 / P5-01 - BullMQ connection/factory:** implement shared queue/worker creation/close with Redis integration test.
88. **B083 / P5-01 - Ingest queue policy:** deterministic `documentId:version`, 3 attempts, 2s exponential+jitter, priority/retention; tests against pinned BullMQ.
89. **B084 / P5-01 - Delete queue policy:** deterministic deletion ID/version and non-duplicating enqueue tests.
90. **B085 / P5-02 - Worker payload validation/re-read:** reject malformed/tampered/stale/deleted work before stages; integration tests.
91. **B086 / P5-02 - Run acquisition/version lock:** implement duplicate/stale active ownership behavior; race tests.
92. **B087 / P5-02 - Ordered stage runner:** stage interface, cancellation checkpoints, typed retryability, `finally` cleanup; unit tests.
93. **B088 / P5-02 - Graceful shutdown:** pause intake, bounded active completion/release, close all clients; SIGTERM test.
94. **B089 / P5-03 - Durable/transient progress publisher:** monotonic sequence, Mongo run update, Redis history/TTL; out-of-order tests.
95. **B090 / P5-03 - Cancellation command/signal:** versioned DB marker + Redis hint and stale/terminal tests.
96. **B091 / P5-04 - Authorized progress SSE:** auth, heartbeat, replay, DB snapshot fallback, sanitized events; Supertest stream tests.
97. **B092 / P5-04 - Web progress hook:** reconnect/backoff/Last-Event-ID/stale-event rejection/durable poll fallback; fake-stream tests.
98. **B093 / P5 - Crash/retry/dead-letter suite:** inject crash at every boundary, Redis loss, exhausted retry, manual new-version recovery.
99. **APPROVAL GATE 5:** run queue/worker/progress/auth isolation validations and stop/report.

## Phase 6 - PDF extraction, normalization, and deterministic chunking

100. **B094 / P6-01 - Temp reservation/job directory:** randomized per-job directory, 150 MiB cap, actual-byte accounting, `finally` cleanup tests.
101. **B095 / P6-01 - Bounded object download:** stream with timeout/hash/byte enforcement and interruption tests.
102. **B096 / P6-02 - Worker PDF signature/open:** repeat signature, open `pdfjs-dist` with limits, map encrypted/malformed/page overflow codes.
103. **B097 / P6-02 - Page iterator/resource disposal:** process maximum 10-page batches and prove page resources/memory are released.
104. **B098 / P6-03 - Text item/page record schema:** capture text, coordinates, transform/rotation/order hints, one-based page; fixture tests.
105. **B099 / P6-03 - Reading-order baseline:** deterministic ordering for simple, multi-column, rotated, and table fixtures; golden tests and limitations.
106. **B100 / P6-04 - Unicode/whitespace normalization:** NFKC policy, whitespace/control handling, identifier preservation, source-offset map tests.
107. **B101 / P6-04 - Broken line/hyphen joins:** conservative page-aware repair rules and golden counterexamples.
108. **B102 / P6-04 - Repeated header/footer detector:** frequency/position threshold with no over-removal in fixtures.
109. **B103 / P6-05 - Low-text/scanned detector:** page/document classification at configured threshold; blank/mixed/text tests.
110. **B104 / P6-05 - Disabled OCR adapter contract:** flags/config validation and stable OCR-required/unsupported behavior; prove no OCR call by default.
111. **B105 / P6-06 - Tokenizer abstraction:** deterministic token counts compatible with configured model and edge-case tests.
112. **B106 / P6-06 - Chunk boundary builder:** 650 target/800 max/100 overlap, headings, sentences, cross-page spans; property tests.
113. **B107 / P6-06 - Stable chunk/content IDs:** canonical serialization+SHA-256 and determinism/change tests.
114. **B108 / P6 - Extraction/chunk integration fixture:** end-to-end worker stages through chunks with exact golden output/checkpoints.
115. **APPROVAL GATE 6:** run extraction/normalization/chunk/resource tests and stop/report.

## Phase 7 - Gemini embeddings and idempotent indexing

116. **B109 / P7-01 - Embedding provider interface/errors:** typed request/result/model/dimension/usage/timeout contract with mocks.
117. **B110 / P7-01 - Gemini embedding adapter:** isolate `@google/genai`, validate response count/vector finiteness/dimension; mocked adapter tests.
118. **B111 / P7-02 - Count+token batcher:** maximum 32 chunks plus token limit, stable batches; boundary tests.
119. **B112 / P7-02 - Concurrency/rate scheduler:** semaphore=2, bounded retry/cancellation, no unbounded `Promise.all`; fake-provider tests.
120. **B113 / P7-03 - Chunk bulk upsert:** scoped version/stable ID operations of max 100 records; duplicate tests.
121. **B114 / P7-03 - Resume/skip matching chunks:** compare hash/model/dimension and embed only missing/mismatched; usage idempotency tests.
122. **B115 / P7-03 - Stale batch write guard:** prevent older run writes/status after reprocess; race test.
123. **B116 / P7-04 - Completeness/compatibility gate:** expected/stored/model/dimension invariant and missing-chunk tests.
124. **B117 / P7-04 - Atlas search visibility gate:** bounded polling in gated Atlas test; ready only when searchable.
125. **B118 / P7 - Full partial-failure integration:** fail mid-batch, retry, verify no duplicates/double usage and correct readiness.
126. **APPROVAL GATE 7:** run AI/indexing suites; report real Atlas suite availability exactly.

## Phase 8 - Hybrid retrieval and evidence selection

127. **B119 / P8-01 - Question normalizer/hash:** deterministic normalization without losing exact identifiers; unit tests.
128. **B120 / P8-01 - Authorized ready-source resolver:** conversation/workspace/document/ready-version checks and deletion/reprocess race tests.
129. **B121 / P8-01 - Versioned cache-key builder:** environment/workspace/question/sorted sources+versions/model/retrieval/prompt; tenant/version snapshots.
130. **B122 / P8-02 - Query embedding orchestration/cache:** model-versioned embedding cache, reauthorization, Redis-down fallback; tests.
131. **B123 / P8-02 - Vector query builder:** 20 candidates and in-pipeline workspace/document/version filters; structural query tests.
132. **B124 / P8-02 - Vector Atlas integration:** semantic fixtures plus seeded higher-score foreign/stale chunks; gated test.
133. **B125 / P8-03 - Lexical query builder:** 20 candidates, exact/heading search, identical in-pipeline filters; structural tests.
134. **B126 / P8-03 - Lexical Atlas integration:** code/name/date/formula fixtures plus foreign/stale exclusion; gated test.
135. **B127 / P8-04 - Reciprocal-rank fusion:** deterministic fusion/tie rules/versioned weights; unit tests.
136. **B128 / P8-04 - Overlap/content deduplication:** stable/source-span/content overlap rules preserving document/page diversity; tests.
137. **B129 / P8-04 - Lightweight reranker:** exact-term/heading/rank/diversity features with deterministic snapshots.
138. **B130 / P8-04 - Context budgeter:** maximum 8 chunks/7,000 tokens and multi-page/document coverage tests.
139. **B131 / P8-05 - Evidence gate:** explicit insufficient result before generation, initial 0.35 configuration, no probability labels; tests.
140. **B132 / P8 - Retrieval evaluation baseline:** facts/exact/synthesis/conflict/absent categories with Hit@K/MRR report.
141. **APPROVAL GATE 8:** review evaluated threshold and retrieval baseline before generation integration.

## Phase 9 - Grounded generation, citations, persistence, and answer SSE

142. **B133 / P9-01 - Structured answer schema:** answer/refusal, atomic claim IDs, source refs/pages/excerpts/conflict/uncertainty; malformed cases.
143. **B134 / P9-01 - Versioned grounded prompt:** untrusted delimiters/no document instructions/no tools/only evidence; snapshot/injection tests.
144. **B135 / P9-02 - Generation provider interface:** structured output/timeouts/errors/tokens/model metadata; mocks.
145. **B136 / P9-02 - Gemini generation adapter:** isolate SDK, low temperature/max output, parse unknown, stable retry mapping; tests.
146. **B137 / P9-03 - Source identity validator:** document/chunk/version membership in exact retrieved set; foreign/unknown tests.
147. **B138 / P9-03 - Page/excerpt validator:** page in source spans and normalized excerpt substring; Unicode/wrong-page tests.
148. **B139 / P9-03 - Claim coverage validator:** every factual claim covered; no dangling/duplicate/unused source IDs; property tests.
149. **B140 / P9-03 - Conflict/insufficiency validator:** both sides cited; refusals contain no speculative answer/citations; tests.
150. **B141 / P9-04 - Idempotent question record:** unique client request/conversation/user handling and concurrent retry tests.
151. **B142 / P9-04 - Atomic answer/citation persistence:** complete/refusal/failure with retrieval/model/prompt/usage/latency metadata; partial-write tests.
152. **B143 / P9-04 - Validated answer cache:** write after persistence/validation, reauthorize hit, TTL/version/access/deletion invalidation, poisoned/Redis-down tests.
153. **B144 / P9-05 - Additive question SSE endpoint contract:** CSRF/idempotency/progress/terminal response while retaining JSON S02 endpoint.
154. **B145 / P9-05 - Citation-safe stream producer:** buffer provider output, validate, then emit answer/citation events; prove no raw token leak.
155. **B146 / P9-05 - Stream disconnect/retry:** deterministic event IDs/client request recovery/no duplicate messages; tests.
156. **B147 / P9 - End-to-end RAG integration:** semantic, lexical, multi-page/document, conflict, absent, injection, malformed output/provider outage.
157. **APPROVAL GATE 9:** report citation/refusal/evaluation and streaming safety results; stop.

## Phase 10 - Complete resource APIs

158. **B148 / P10-01 - Document list/detail:** cursor/status/search and processing summary, exact DTOs, cross-workspace tests.
159. **B149 / P10-01 - Document rename:** role/state/validation and audit; tests.
160. **B150 / P10-01 - Reprocess command:** atomic version increment/run/job, prior-ready availability, concurrent/stale tests.
161. **B151 / P10-01 - Cancel command:** versioned cooperative request/state conflicts and tests.
162. **B152 / P10-01 - Authorized view URL:** current role/object/page hint/600s URL, missing/foreign/deleting tests.
163. **B153 / P10-01 - Document delete/tombstone:** 202 contract, in-flight policy, idempotency tests.
164. **B154 / P10-01 - Deletion worker:** scoped object/chunk/cache/artifact/source cleanup checkpoints/retry and partial-failure tests.
165. **B155 / P10-02 - Collection create/list:** same-workspace documents/name uniqueness/cursors/roles and tests.
166. **B156 / P10-02 - Collection detail/update:** exact contracts and conflict/foreign tests.
167. **B157 / P10-02 - Collection membership replace/delete:** atomic full validation/soft delete and tests.
168. **B158 / P10-03 - Conversation create/list:** immutable 1-20 ready sources/cursors/preview and tests.
169. **B159 / P10-03 - Conversation detail/update/delete:** message cursor, archive/title/delete state and tests.
170. **B160 / P10-03 - Citation list/source:** message/citation/document/version reauthorization, correct page/expiry and tests.
171. **B161 / P10 - Full S02 contract matrix:** verify every route/status/error/example and forbidden-field projection.
172. **APPROVAL GATE 10:** run full API/integration/isolation suite and stop/report.

## Phase 11 - Core frontend and complete UX states

173. **B162 / P11-01 - Router/guards/AppShell:** exact S03 routes, error boundary, focus-on-route, sidebar/topbar/tray/toasts; tests.
174. **B163 / P11-01 - Typed API client:** credentials, CSRF, envelope errors, one refresh retry/no loops; unit tests.
175. **B164 / P11-01 - Auth/Workspace providers:** identity+CSRF only, selected workspace, cancel/clear scoped query data on switch; tests.
176. **B165 / P11-01 - Login/Register pages:** accessible fields, preserving input, neutral errors/loading/focus; component/E2E tests.
177. **B166 / P11-02 - Documents list toolbar/grid/pagination:** loading/success/empty/error/partial states at 360px and desktop.
178. **B167 / P11-02 - Document card status/actions:** all status enums and role-aware controls without treating UI as authorization.
179. **B168 / P11-02 - Activity tray/SSE integration:** uploading through terminal, reconnect/durable fallback/cancel/retry states.
180. **B169 / P11-02 - Document detail/timeline/actions:** no fake page count, failed/cancelled/reprocess/delete states and tests.
181. **B170 / P11-03 - Collections list/create/detail:** exact hierarchy, query states, accessible modal only where approved; tests.
182. **B171 / P11-03 - Ready-document picker/new conversation:** 1-20 selection, stale unauthorized removal announcement, tests.
183. **B172 / P11-03 - Conversation list/detail metadata:** cursors/empty/error/selected-source summary and tests.
184. **B173 / P11-04 - Message list/composer:** typing/over-limit/submitting/rate/dependency/retry, Enter/Shift+Enter, no invented loading text.
185. **B174 / P11-04 - Answer event reducer:** idempotent ordered validated SSE events, JSON fallback equivalence, disconnect tests.
186. **B175 / P11-04 - Assistant/refusal/failure messages:** claim citations, insufficient panel, inline retry, safe Markdown.
187. **B176 / P11-05 - Citation chips/source API:** keyboard Enter/Space, labels, loading/stale/access states; component tests.
188. **B177 / P11-05 - PDF.js source drawer:** authorized URL, exact page, one expiry refresh, excerpt highlight when mapping exists; E2E.
189. **B178 / P11-05 - Markdown/XSS sanitizer:** allow-list only, unsafe HTML/images/schemes removed; security tests.
190. **B179 / P11-06 - Accessibility audit:** focus return/live regions/icons+text/44px/reduced motion/keyboard/axe; fix and retest.
191. **B180 / P11-06 - Responsive/state E2E:** 360px/no page scroll, desktop drawer, every S03 loading/empty/error/cancel/retry state.
192. **B181 / P11 - Complete MVP journey E2E:** two uploads, navigate during processing, multi-doc answer, citations, refusal, cache repeat, retry.
193. **APPROVAL GATE 11:** report frontend/unit/E2E/accessibility results and stop.

## Phase 12 - Security, evaluation, observability, CI/CD, and release readiness

194. **B182 / P12-01 - Threat model:** document assets/actors/boundaries/threats/controls/tests for upload/parser/tenant/prompt/cache/citation/signed URLs.
195. **B183 / P12-01 - HTTP hardening:** Helmet, explicit CORS, proxy/body/timeouts/cookies and production config tests.
196. **B184 / P12-01 - File/parser hardening:** malicious PDF corpus/resource/process restrictions and fail-closed scan policy when enabled.
197. **B185 / P12-02 - Repository/API isolation matrix:** all tenant entities/read/write/delete with two workspaces.
198. **B186 / P12-02 - Atlas isolation matrix:** vector/lexical filters defeat higher-score foreign/stale chunks.
199. **B187 / P12-02 - Redis/SSE isolation matrix:** cache/progress/locks/rates/reconnect never cross workspace.
200. **B188 / P12-02 - Storage/citation isolation matrix:** signed URLs/pages/citations/deletion fail closed across tenants.
201. **B189 / P12-03 - Evaluation dataset schema/fixtures:** immutable public/synthetic facts/exact/synthesis/conflict/absent/injection cases and hash.
202. **B190 / P12-03 - Retrieval metrics runner:** Hit@1/5/10 and MRR with version/config report.
203. **B191 / P12-03 - Citation/answer metrics runner:** precision, coverage, faithfulness, unsupported-claim, correct/false refusal with review rubric.
204. **B192 / P12-04 - Future learning metric schemas:** quiz key, note citation, debate evidence coverage only; no runtime feature.
205. **B193 / P12-05 - Request/job/stage metrics:** bounded labels, durations/failures/queue depth/ingestion success; tests.
206. **B194 / P12-05 - Retrieval/provider/cache/cost metrics:** candidates/hits/tokens/cache/version without content/high-cardinality labels; tests.
207. **B195 / P12-06 - Large-file resource tests:** boundary/over-limit synthetic fixtures, RSS/temp/time/backpressure cleanup report.
208. **B196 / P12-06 - Concurrent question/load tests:** cached/uncached latency/error/quota/connection behavior with stated conditions.
209. **B197 / P12-06 - Dependency fault drills:** Gemini/Redis/Mongo/S3/Atlas outages and recovery with no fabricated/corrupt state.
210. **B198 / P12-07 - Secret/dependency/license gates:** CI secret scan, lockfile audit/review, license policy, exceptions process.
211. **B199 / P12-07 - Container/SBOM gates:** API/worker images, non-root/resource/health settings, vulnerability scan and provenance.
212. **B200 / P12-08 - Deployment manifests:** Vercel web and explicitly selected API/worker provider, no resource creation without approval.
213. **B201 / P12-08 - Atlas/Redis/S3 operations:** index rollout, eviction policy, lifecycle, backups/restore, credential rotation docs.
214. **B202 / P12-08 - Reprocessing/rollback runbooks:** version switches, worker pause/resume, prior ready index, smoke/trigger criteria.
215. **B203 / P12-08 - Staging validation:** execute all steps in the release plan and record results/known risks.
216. **B204 / P12-08 - Complete repository validation:** run each required AGENTS command separately plus `git diff --check`; disclose every skip/failure.
217. **APPROVAL GATE 12 / MVP RELEASE:** present measured quality/security/performance evidence and obtain explicit deployment approval.

## Phase 13 - Optional learning features (separate scope approvals)

218. **B205 / P13-01 - LearningArtifact/source snapshot models:** add only after approval; tenant/version/citation/idempotency tests.
219. **B206 / P13-01 - Learning queue/progress/contracts:** `learning.artifacts.generate.v1`, ID/version payloads, quotas/cost preflight, SSE tests.
220. **B207 / P13-01 - Shared artifact validator/cache/revision/delete:** implement exact shared controls and isolation/privacy tests.
221. **B208 / P13 - Explain selected passage:** implement the `05-v2-learning-features.md` contract/evaluation as first MVP+ slice.
222. **B209 / P13 - Ask questions from page:** implement page-scoped question/ambiguity/evidence contract.
223. **B210 / P13 - Study notes:** implement hierarchical cited notes, edits/revisions, then separately approved exports.
224. **B211 / P13 - Flashcards:** implement candidate/duplicate/ambiguity/evidence validation and approval.
225. **B212 / P13 - Quiz:** implement MCQ first, then multiple-select/true-false/short-answer in separate focused changes; add sessions/scoring/retry.
226. **B213 / P13 - Fill-in-the-blank:** implement validated cloze generation and server-hidden answer attempts.
227. **B214 / P13 - Socratic tutoring:** implement bounded turns, source-grounded prompts, learner privacy, and session summary.
228. **B215 / P13 - Spaced repetition:** implement deterministic scheduler/review history after flashcards.
229. **B216 / P13 - Multi-PDF comparison:** implement per-source retrieval/coverage/conflict-preserving synthesis.
230. **B217 / P13 - Timelines:** implement date/event extraction/normalization/conflicts.
231. **B218 / P13 - Progress/knowledge gaps:** implement activity event aggregation with user-only privacy controls.
232. **B219 / P13 - Practice exams:** implement blueprint, items, server-hidden keys, timed sessions, rubrics only after quiz evidence.
233. **B220 / P13 - Agreement/contradiction:** implement claim alignment/classification/human review only after comparison evidence.
234. **B221 / P13 - Debate mode:** implement evidence preflight, both sides, rebuttals, weakness/uncertainty after relationship evaluator passes.
235. **B222 / P13 - Concept maps:** implement cited nodes/edges and accessible outline.
236. **B223 / P13 - Glossary games:** implement deterministic games from already validated glossary content.
237. **B224 / P13 - Collaborative notes:** implement asynchronous optimistic revisions/comments/revalidation after workspace collaboration approval.
238. **B225 / P13 - Instructor assignments:** implement roles/content snapshots/submissions/grading only after privacy/legal/product approval.
