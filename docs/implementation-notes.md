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

## Risks checked

| Risk | Result |
|---|---|
| R1 Vitest decorator metadata | **PASS** - template `AppController` spec resolves `AppService` through DI under Vitest 4.1.11 (Vite transform, no SWC plugin) |
| R2 scaffold into existing folder | solved by scaffolding into a temp folder (Task 1) |
| R3 ESM + TypeORM circular relations | not reachable: no relations |
| R4 vector round-trip | **PASS** - TypeORM 1.1 writes `number[]` into `vector(768)` with no transformer (e2e: chunks have embeddings; a 767-length array is rejected by Postgres) |
| R5 Docker 29 + Testcontainers | **PASS** - Docker server 29.4.0, `@testcontainers/postgresql` 12.2.1 started `pgvector/pgvector:pg16` with no API-version pin (springboot-rag's docker-java needed `api.version=1.44`; Node Testcontainers uses a different client) |
| R6 HNSW + filter | |
| R7 AI SDK 7 names | `instructions`, `isStepCount`, `MockLanguageModelV4` (read from types) |
| R8 qwen3 reasoning | |

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
