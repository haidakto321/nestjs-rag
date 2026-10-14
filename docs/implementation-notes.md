# Implementation notes - nestjs-rag

Running log of decisions not in the spec, changes, tradeoffs, and things to know.
Spec: `docs/superpowers/specs/2026-10-14-nestjs-rag-design.md`.
Plan: `docs/superpowers/plans/2026-10-14-nestjs-rag.md`.

## Decisions and deviations

| Date | Phase | Decision | Why |
|---|---|---|---|
| 2026-10-14 | plan | `JWT_TTL_SECONDS` (number) replaces `JWT_EXPIRES_IN=1h` | `@types/jsonwebtoken` 9.0.10 types `expiresIn` as `StringValue \| number` |
| 2026-10-14 | plan | Hand-written SQL migrations, run at boot (`migrationsRun: true`); CLI runs from `dist` | no ts-node; e2e gets the schema for free; SQL stays visible |
| 2026-10-14 | plan | One global `AppExceptionFilter` instead of `TypeOrmExceptionFilter` | two global catch-all filters have no defined order |
| 2026-10-14 | plan | Too-large upload is 413 (multer limit), not 400 | multer stops reading at the limit |
| 2026-10-14 | plan | Custom `FileExtensionValidator` | Nest 12 `FileTypeValidator` checks magic bytes; text files have none |
| 2026-10-14 | plan | WS auth in socket.io namespace middleware | clean `connect_error`, no race with early messages |
| 2026-10-14 | plan | No `documents.owner_id` btree index | the unique `(owner_id, filename)` index serves it |
| 2026-10-14 | plan | `CHAT_THINK` env, default `true` | non-reasoning models reject `think: true` |
| 2026-10-14 | plan | Upload rejects NUL bytes | Postgres `text` cannot store `\u0000` |
| 2026-10-14 | plan | HNSW `iterative_scan = strict_order` in an explicit transaction | permission filter runs after the index scan |
| 2026-10-14 | plan | `DocumentEntity` / `ChunkEntity`, no TypeORM relations | `Document` is a DOM global; no relation needed, so R3 cannot occur |
| 2026-10-14 | 1 | **Node 26.10.0 pinned per project** (`.nvmrc`, nvm-windows shim mode); global default stays 22.14 | Nest CLI 12.0.8 pulls `@angular-devkit/schematics` 22, which needs Node `^22.22.3 \|\| ^24.15.0 \|\| >=26`; on 22.14 `nest new` crashed with `ERR_REQUIRE_CYCLE_MODULE`. 26.10.0 was already installed (no download) |
| 2026-10-14 | 1 | `engines.node` = `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` (plan said `>=22.13`) | matches the strictest dependency (the CLI's angular-devkit) |
| 2026-10-14 | 1 | Scaffold came from schematics 12.0.0 (bundled in CLI 12.0.8), not the 12.0.7 template read at plan time: `oxlint.json` (not `.oxlintrc.json`), lint without `--type-aware`, Vitest with the `vite-tsconfig-paths` plugin | the CLI pins its own schematics version |
| 2026-10-14 | 1 | Replaced the `vite-tsconfig-paths` plugin with Vite's built-in `resolve.tsconfigPaths: true` and uninstalled the plugin | Vite printed a deprecation warning on every test run; the built-in option is what the newer template uses |
| 2026-10-14 | 1 | `.superpowers/` added to `.gitignore` | the plan-execution ledger lives there |
| 2026-10-14 | 1 | **App port 3001, Postgres host port 5434** (spec said 3000 / 5433) | the user's running kafka-demo stack holds 3000 (Grafana) and 5433 (Postgres); defaults, compose file, `.env.example` and the env test all use the new ports |
| 2026-10-14 | 1 | `.env` is created by the user, not by Claude | a secret-file guard blocks any shell command touching `.env`; the e2e harness sets its own env, CLI/dev checks used an inline throwaway `JWT_SECRET` |
| 2026-10-14 | 1 | Migrations run at boot (`migrationsRun: true`) | a broken migration now stops the app at startup - intended: fail loud, never run on a half-migrated schema |
| 2026-10-14 | 1 | `npm audit`: production deps 0 findings; 5 dev-only (`tmp`, `undici`) via the CLI / Testcontainers chain | left as is: dev tooling, no runtime exposure; recheck when those packages update |
| 2026-10-14 | 1 | RTK hook rewrites `npm test` / `vitest` / lint output into summaries that hide failures | run test commands as `rtk proxy npm ...` to see real output |
| 2026-10-14 | 2 | Request pipeline as built: `RequestIdMiddleware` -> guards (`JwtAuthGuard`, then `RolesGuard`, in `APP_GUARD` registration order) -> interceptors (`TimingInterceptor` outermost, then `ClassSerializerInterceptor`) -> pipes (`ValidationPipe`) -> handler -> interceptors on the way out -> `AppExceptionFilter` | the order is the lesson: a 401/403 never reaches the pipe, and the timing header includes serialization |
| 2026-10-14 | 2 | `JwtStrategy.validate` does not hit the DB | stateless and cheap; tradeoff: a deleted user (or a demoted admin) keeps access until the token expires (`JWT_TTL_SECONDS`, 1h) |
| 2026-10-14 | 2 | Password DTO capped at 72 characters | bcrypt only reads the first 72 bytes; longer input would be silently cut. (Multi-byte UTF-8 can still exceed 72 bytes under 72 characters - accepted for a sandbox) |
| 2026-10-14 | 2 | Login compares against `DUMMY_HASH` when the email is unknown | both failure paths cost one bcrypt run and return the same 401 body, so emails cannot be enumerated by timing or message |
| 2026-10-14 | 2 | Register rejects any `role` field (`forbidNonWhitelisted`) and always creates `user`; the first admin comes only from `ADMIN_EMAIL` / `ADMIN_PASSWORD` at boot | no HTTP path can mint an admin |
| 2026-10-14 | 2 | `roles.e2e-spec` was written after the guard (plan order); its 403 test was proven by removing the global `RolesGuard` (went red: got 200), then restoring it | a test you never saw fail proves nothing |
| 2026-10-14 | 2 | Live check against the compose DB (built app, inline env): admin seeded, register / login / me OK, `/users` 403 for a user, 200 for the admin, 401 without token | |
| 2026-10-14 | 3 | `AiModule` is a dynamic module built with `ConfigurableModuleBuilder` (`forRootAsync` + an `isGlobal` extra) | the same mechanism behind `TypeOrmModule.forRootAsync` / `JwtModule.registerAsync`, written by hand once |
| 2026-10-14 | 3 | `EMBEDDING_PROVIDER` is a `Symbol` token for an interface | TS interfaces do not exist at runtime; tests swap in `FakeEmbeddingProvider` with `overrideProvider(EMBEDDING_PROVIDER)` |
| 2026-10-14 | 3 | Ollama errors reach the client as a generic `503 Embedding service unavailable`; details go to the log only. A dimension mismatch is the exception: its message names both numbers | upstream error bodies can leak internals; a config mistake is not a secret and needs a clear message |
| 2026-10-14 | 3 | Custom `FileExtensionValidator` (Nest 12 `FileTypeValidator` checks magic bytes, text has none) and a multer `fileSize` limit via `MulterModule.registerAsync` (too large -> 413) | |
| 2026-10-14 | 3 | Embeddings are computed before the transaction; document + chunks are inserted in one explicit `dataSource.transaction()` | no transaction waits on Ollama; proven by a test that forces a chunk insert failure (767-dim vector): 500 with request id, zero documents left |
| 2026-10-14 | 3 | e2e tests cast `count(*)::int` | Postgres `count` is `bigint`, which `pg` returns as a string |
| 2026-10-14 | 3 | oxlint `unicorn/no-new-array`: `new Array<number>(n).fill(x)` replaced by `Array.from({ length: n }, () => x)` in tests | plan code tripped the rule; behaviour unchanged |
| 2026-10-14 | 3 | Live check with real Ollama: startup logs `Embedding model reachable (768 dims)`; uploading the 593-line spec gave 40 chunks with correct heading trails in **25 s** | the upload is synchronous, so the HTTP request waits for all embeddings (cold model load included). Fine for a sandbox; a real app would queue it (spec stretch item: BullMQ) |
| 2026-10-14 | 3 | Live "Ollama down" check by pointing `OLLAMA_BASE_URL` at a dead port (not by stopping the user's Ollama): startup warns and continues, upload answers 503, listing still 200 | |
| 2026-10-14 | 3 | Installed Ollama models are `nomic-embed-text` and **`qwen3:4b`**; the spec default `CHAT_MODEL=qwen3:8b` is not pulled | decide in Phase 5: set `CHAT_MODEL=qwen3:4b` in `.env`, or pull 8b |
| 2026-10-14 | 4 | Search SQL lives in `SearchRepository` (`dataSource.query`); the visibility rule is part of every `WHERE` (`readableSql`) | TypeORM has a `vector` column type but no similarity API: this is where the ORM stops. Filtering after the query would leak through `topK` counts and timing |
| 2026-10-14 | 4 | The vector `ORDER BY` is the distance only (no `, c.id` tie-break), unlike FTS | an extra sort key stops Postgres from using the HNSW index (caught while writing the plan) |
| 2026-10-14 | 4 | `/search/compare` embeds once and runs the modes one after another | `Promise.all` would be easy in Node, but parallel runs share the DB and blur the per-mode timings |
| 2026-10-14 | 4 | `CompareQueryDto = OmitType(SearchQueryDto, ['mode'])` | Swagger mapped types copy validation rules, transforms and default values |
| 2026-10-14 | 4 | Live `/search/compare` with real Ollama (spec + notes uploaded, 51 chunks): SQL per mode 1-9 ms, query embedding about 2 s (it dominates). Exact tokens (`JWT_TTL_SECONDS`, `HNSW iterative scan`): FTS, vector and hybrid agree on the top hit. Paraphrase ("how do I stop a user from making themselves admin"): **FTS returns nothing**, vector and hybrid find the users / auth sections | same lesson as springboot-rag: exact codes favour FTS, paraphrases favour vector, hybrid covers both |
| 2026-10-14 | 5 | Installed `ai` 7.0.140, `ai-sdk-ollama` 4.5.0, `@nestjs/websockets` + `@nestjs/platform-socket.io` 12.1.3, `@nestjs/serve-static` 12.0.0, dev `socket.io-client` 4.8.4 (all in the spec list). `npm audit --omit=dev`: 0 | dev-only `tmp` / `undici` advisories come from `@nestjs/mau` and `testcontainers` (were there before Phase 5); `audit fix --force` would make breaking changes, so left alone |
| 2026-10-14 | 5 | `ChatService.ask()` is an async generator that yields `ChatEvent`s and knows nothing about sockets; `ChatGateway` emits each event's `type` as the socket event name | an SSE controller would be a second adapter over the same generator, service unchanged |
| 2026-10-14 | 5 | Socket auth lives in socket.io namespace middleware (`afterInit` -> `namespace.use`). A missing or forged token gets `connect_error: Unauthorized` and never connects | HTTP guards (the global `JwtAuthGuard`) do not run for the handshake |
| 2026-10-14 | 5 | The token is checked once, at connect | a token that expires during a long connection keeps working until disconnect (accepted limitation) |
| 2026-10-14 | 5 | `import type { Socket }` in the gateway | a value import puts the `Socket` class into decorator metadata, and a `ValidationPipe` with `transform: true` would then try to rebuild the socket as if it were a DTO |
| 2026-10-14 | 5 | Filters are per transport: `AppExceptionFilter` answers HTTP, `WsExceptionFilter` emits an `error` event. 4xx and 503 text reach the client; anything else becomes `Internal error` + a request id, details in the log only | same "no internals to the client" rule as HTTP |
| 2026-10-14 | 5 | **Ruling:** the plan's disconnect e2e passed even with the abort removed (checked by mutation), because `handleDisconnect` also deleted the map entry, so `activeGenerations` hit 0 anyway. The test now also asserts the model call's `abortSignal.aborted` (red on the no-abort mutant, green restored), and `handleDisconnect` only aborts: the `finally` in `ask()` owns the delete | the gauge now means "loops still running", not "loops someone forgot about" |
| 2026-10-14 | 5 | **Ruling:** `createTestApp` overrides serve-static's `AbstractLoader` with `ExpressLoader` | serve-static picks its loader in a provider factory; a `TestingModule` builds providers in `compile()`, before an HTTP adapter exists, so it picked the no-op loader and `/ui/chat.html` was 404 in e2e only. The built app served 200 all along |
| 2026-10-14 | 5 | The `/socket.io/socket.io.js` e2e test was green before `ServeStaticModule` was added | the socket.io server serves its own client script; the test stays as a guard for what the page loads |
| 2026-10-14 | 5 | Provider scope: everything here is a singleton | a `REQUEST`-scoped provider makes every provider that depends on it request-scoped too (new instance graph per request); Spring's request scope only proxies the one bean |
| 2026-10-14 | 5 | README written with Node 26.10.0 (`.nvmrc`) + `engines`, ports 3001 / 5434, and a `CHAT_MODEL` hint | the plan's README text still said Node 22.13+ and port 3000 |
| 2026-10-14 | 5 | **Live smoke, `qwen3:4b`, `CHAT_THINK=true`** (socket.io-client script doing what the page does, spec + notes uploaded): "Which host port does Postgres use?" -> sources after 2.4 s, **first token after 324 s**, done after 334 s, 3000 output tokens, 10,734 reasoning characters dropped. Answer: "5434 ... [1]" (correct, cited), no reasoning in the answer | almost all the time is hidden reasoning. Ollama had the model only partly on the GPU (2.3 of 3.5 GB in VRAM) |
| 2026-10-14 | 5 | **Live smoke, `CHAT_THINK=false`:** first token after 1.4 s, but qwen3 **still reasons**, and the reasoning arrives as answer text ending in `</think>` (164 s, 1953 tokens) | so for qwen3 the fix in plan Task 20 step 5 is backwards: keep `CHAT_THINK=true`; use `false` only for a model that does not reason. A possible extra guard (not built): AI SDK `extractReasoningMiddleware({ tagName: 'think' })` via `wrapLanguageModel` |
| 2026-10-14 | 5 | Live cancel: `cancel` after 5 tokens -> `done: aborted` at 1.0 s. Agent mode -> `error: mode must be one of the following values: rag` (expected until Phase 6). Ollama down (dead `OLLAMA_BASE_URL`): startup WARN, ask -> `error: Embedding service unavailable`, app keeps answering HTTP | |
| 2026-10-14 | 5 | Seen live, not changed: source labels repeat the title ("Implementation notes - nestjs-rag > Implementation notes - nestjs-rag > Decisions ...") | the chunker's `headingPath` starts with the H1, which is also the document title. Cosmetic, plus a few prompt tokens per passage |
| 2026-10-14 | 5 | Seen live, not changed: Ollama ran `qwen3:4b` with `context_length 4096`; this question used 1483 prompt tokens + 3000 output tokens | close to the limit; a longer prompt or reasoning trace can be cut without an error. `ai-sdk-ollama` can pass `num_ctx`; not in the spec, so not set |
| 2026-10-14 | 6 | Agent tools are built per request by `buildAgentTools(search, user, onResult)`; the caller lives in the closure, the model only fills `{ query }` | the model picks WHAT to search, never WHOSE documents. Proven by mutation: making the tool search as an admin turned the e2e red (`'Bob secret'` leaked into the sources), restored -> green |
| 2026-10-14 | 6 | AI SDK 7 shape: `tool({ description, inputSchema: z.object(...), execute })`, `streamText({ tools, stopWhen: isStepCount(3) })` | `stopWhen` caps model steps; a model that keeps calling tools ends with `done: tool-calls` after 3 calls (unit test) |
| 2026-10-14 | 6 | Agent sources are numbered across tool calls (1-5, 6-10, ...) and emitted when the stream reports the `tool-result` | the tool's `execute` runs inside the SDK, not inside our generator, so it queues the `sources` event and the relay flushes it in stream order |
| 2026-10-14 | 6 | The agent e2e was written after the implementation (plan order), so its permission assertion was proven by the mutation above, not by a red-first run | |
| 2026-10-14 | 6 | **Live agent check (partial).** Standalone script (same `ai` + `ai-sdk-ollama`, one fake tool, `qwen3:4b`, think on): tool call at 24 s with `{"query":"PostgreSQL default port"}`, answer finished at 76 s. In the app over socket.io: tool call at 20.8 s (`"Postgres default port"`) and 123.6 s on a second run (`"Postgres port"`), `sources` about 2 s after each call (query embedding). Neither in-app run reached the answer: the first hit my 60 s client cap (disconnect -> abort, log `Dropped 3374 reasoning characters`), the second was stopped by Claude Code because the machine ran critically low on memory | qwen3:4b does call the tool on its own and rewrites the question into a search query. Not yet seen live: a full in-app agent answer, and the RAG vs agent refusal comparison on an unanswerable question |
| 2026-10-14 | 6 | A first 30-minute "hang" in the live check was a bug in my smoke script (it never emitted `ask`), not in the app. Ollama's log showed no `/api/chat` request at all, which pointed to the client | |

## Risks checked

| Risk | Result |
|---|---|
| R1 Vitest decorator metadata | **PASS** - template `AppController` spec resolves `AppService` through DI under Vitest 4.1.11 (Vite transform, no SWC plugin) |
| R2 scaffold into existing folder | solved by scaffolding into a temp folder (Task 1) |
| R3 ESM + TypeORM circular relations | not reachable: no relations |
| R4 vector round-trip | **PASS** - TypeORM 1.1 writes `number[]` into `vector(768)` with no transformer (e2e: chunks have embeddings; a 767-length array is rejected by Postgres) |
| R5 Docker 29 + Testcontainers | **PASS** - Docker server 29.4.0, `@testcontainers/postgresql` 12.2.1 started `pgvector/pgvector:pg16` with no API-version pin (springboot-rag's docker-java needed `api.version=1.44`; Node Testcontainers uses a different client) |
| R6 HNSW + filter | **Handled.** pgvector is 0.8.2, so `SET LOCAL hnsw.iterative_scan = strict_order` (inside an explicit transaction) is supported. On the dev DB (40 chunks) the planner picks seq scan + sort, even with `enable_seqscan=off`; with `enable_sort=off` too it shows `Nested Loop -> Index Scan using chunks_embedding_hnsw_idx`, so the query shape can use HNSW once the table is large. e2e "fills topK when most nearby chunks are hidden" passes (60 hidden chunks, topK 3) |
| R7 AI SDK 7 names | **PASS** - `instructions`, `isStepCount`, `MockLanguageModelV4` (read from types). `fullStream` parts seen at runtime: `start`, `start-step`, `text-start`, `text-delta` (`text`), `reasoning-delta` (`text`), `finish` (`finishReason`, `totalUsage`). After `abort()` the stream emits an `abort` part and the loop ends normally, no throw |
| R8 qwen3 reasoning | **PASS with `CHAT_THINK=true`** - reasoning arrives as `reasoning-delta` parts and is dropped (10,734 characters on one question). With `CHAT_THINK=false` qwen3 still reasons and it leaks into the answer text (ends in `</think>`) |

## Node vs Java

| Topic | springboot-rag (Java) | nestjs-rag (Node) |
|---|---|---|
| Interfaces for DI | Java interface is a runtime type | TS interface is erased; needs a token |
| CPU work | blocks one request thread | blocks the whole event loop |
| Streaming | `StreamingResponseBody` + hand-written NDJSON reader | `for await` over AI SDK streams; socket.io emits |
| DB access | `JdbcTemplate`, SQL visible | TypeORM entities + migrations, raw SQL for vector / FTS |
| `bigint` from Postgres | `long` | string in `pg` unless cast (`count(*)::int`) |
| Validation | Bean Validation annotations | decorators on classes; plain TS types do nothing at runtime |
| AI framework | none (hand-written) | Vercel AI SDK: provider swap is config |
| Runtime version per project | Maven toolchain / `JAVA_HOME` | `.nvmrc` + nvm shim; the CLI's own deps can force a newer Node than the app needs |
| Config validation | `@ConfigurationProperties` + `@Validated` | `ConfigModule.forRoot({ validate })` with a zod schema; `registerAs` namespaces injected by `KEY` with `ConfigType<typeof x>` |
| Request middleware | servlet `Filter` / `OncePerRequestFilter` | `NestMiddleware` applied in `configure(consumer)`; runs before guards, knows nothing about the handler |
| Around-handler logic | `HandlerInterceptor` or AOP `@Around` | `NestInterceptor` returning an RxJS `Observable` (`tap` for timing); sees the handler's return value |
| Global pipes / interceptors | `WebMvcConfigurer` beans | `APP_PIPE` / `APP_INTERCEPTOR` providers: global, but built by DI so they can inject things |
| Wildcard routes | Ant patterns `/**` | path-to-regexp 8 named wildcards: `'{*path}'` (braces make it also match `/`) |
| Integration DB in tests | Testcontainers JUnit extension + `@DynamicPropertySource` | Vitest `globalSetup` starts the container, `provide`/`inject` passes its address, a `setupFiles` script writes `process.env` before `AppModule` is imported |
| Public routes | Spring Security `requestMatchers(...).permitAll()` in one central `SecurityFilterChain` | global `JwtAuthGuard` + `@Public()` metadata read by `Reflector` on each handler/class: the exception lives next to the route |
| Auth filter chain | `SecurityFilterChain` of servlet filters | guards (`CanActivate`) after middleware; several global guards run in registration order |
| Role checks | `@PreAuthorize("hasRole('ADMIN')")` (AOP proxy) | `@Roles('admin')` metadata + `RolesGuard`; `applyDecorators` bundles it with Swagger hints into `@Auth('admin')` |
| Hiding fields in JSON | `@JsonIgnore` (Jackson) | `@Exclude()` (class-transformer) + `ClassSerializerInterceptor`; only works on class instances, not plain objects |
| Startup hooks | `ApplicationRunner` / `@EventListener(ApplicationReadyEvent)` | `OnApplicationBootstrap` (after all modules init); `OnModuleInit` is earlier, per module |
| Test-time config override | `@TestPropertySource` / `@MockBean` | `Test.createTestingModule(...).overrideProvider(authConfig.KEY).useValue(...)`: config namespaces are just providers |
| Reusable configurable module | `@AutoConfiguration` + `@ConfigurationProperties` + `@ConditionalOn...` | `ConfigurableModuleBuilder` generating `forRoot` / `forRootAsync`; consumers pass `useFactory` + `inject` |
| Upload size limit | `spring.servlet.multipart.max-file-size` | `MulterModule.registerAsync({ limits: { fileSize } })` -> 413 from multer |
| Transactions | `@Transactional` (proxy, implicit boundary) | `dataSource.transaction(async (manager) => ...)`: explicit boundary, every write must go through `manager` |
| `OR` in queries | `Specification.or(...)` / JPQL | TypeORM `find({ where: [a, b] })`: an array of conditions means OR |
| Raw SQL next to the ORM | `JdbcTemplate` beside JPA repositories | `dataSource.query(sql, params)` with `$1` placeholders; rows come back as plain objects in snake_case, mapped by hand |
| Query params to typed DTO | `@RequestParam int topK` converts automatically | query strings stay strings: `@Type(() => Number)` + `transform: true` before `@IsInt()` |
| Running independent calls | sequential by default; `CompletableFuture` to go parallel | parallel is the easy default (`Promise.all`); `/search/compare` chooses sequential on purpose |
| Producing a token stream | `StreamingResponseBody` writing NDJSON lines; the client parses lines by hand | `async *ask()` yields typed events; any transport loops over it with `for await` |
| Cancelling work | `Future.cancel` / thread interrupt, often ignored by blocking I/O | one `AbortController`; its `signal` goes into `streamText`, which hands it to the model call (seen in the mock's `doStreamCalls`) |
| WebSocket auth | `HandshakeInterceptor` / STOMP `ChannelInterceptor` | socket.io namespace middleware (`namespace.use`) in `afterInit`; HTTP guards never see the handshake |
| Errors per transport | `@ControllerAdvice` for HTTP, `@MessageExceptionHandler` for STOMP | one `ExceptionFilter` per transport: `switchToHttp()` vs `switchToWs()` |
| Bean / provider scope | `@Scope("request")` proxies only that bean | `Scope.REQUEST` bubbles up: every dependent becomes request-scoped too |
| Static files | `src/main/resources/static` served by default | `ServeStaticModule.forRoot({ rootPath, serveRoot })`; not covered by the global guard |
| LLM tool calling | Spring AI `@Tool` methods, or a hand-written loop | AI SDK `tool({ inputSchema: zod, execute })`; the SDK runs the call / result / next-step loop, `stopWhen` caps it |

## Still open (spec section 13 stretch items, none built)

- SSE variant of chat (`@Sse()` + RxJS) as a second adapter over `ChatService`.
- `@nestjs/terminus` health checks.
- A Standard Schema (zod) DTO variant on one controller, compared with class-validator.
- Refresh tokens, logout / token revocation.
- `@nestjs/throttler` rate limiting.
- Queues (BullMQ + Redis) and a Nest monorepo with an ingest worker.
- Reranker, Qdrant, GraphRAG, eval harness (already in springboot-rag).
