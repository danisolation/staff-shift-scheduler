# Milestone Reports

One report per completed milestone, answering three questions:
**what** was delivered, **when** it happened, and **why** each decision was
made. Written for a reader returning to the project weeks later who wants
the milestone's story without re-reading every diff.

---

## Milestone 2 — Database: PostgreSQL, Prisma, migrations

### What

**Infrastructure**

- `docker-compose.yml` at the repo root running two PostgreSQL 16
  containers: `db` (dev, persistent named volume, host port 5434) and
  `test-db` (integration tests, no volume, host port 5433). Both have
  healthchecks.
- `apps/api/.env.example` committed as the template; the real `.env` stays
  gitignored (`DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`).

**Schema and migration**

- `apps/api/prisma/schema.prisma`: `Skill`, `Employee`,
  `AvailabilityWindow` (child table, cascade delete), `EmployeeSkill` and
  `ShiftSkill` (join tables with composite primary keys), `Shift`,
  `SolveJob` + `SolveJobStatus` enum (prepared for Milestone 4, used by no
  code yet), and `createdAt` columns for deterministic list ordering.
- First migration `20260901035347_init` committed, including one
  hand-added statement: a case-insensitive unique index
  (`CREATE UNIQUE INDEX "Skill_name_lower_key" ON "Skill"(lower("name"))`).
- Applied to the dev database with `prisma migrate dev` and to the test
  database (and later CI) with `prisma migrate deploy`.
- Dependencies: `@prisma/client` 6.19.3, `prisma` 6.19.3, `dotenv`;
  engine build scripts approved in `pnpm-workspace.yaml` `allowBuilds`.

**Application code (apps/api)**

- `src/config/env.schema.ts` — zod schema validating environment once at
  boot; `AppModule` wires `ConfigModule.forRoot({ validate })`;
  `main.ts` reads the port from typed `ConfigService` and enables shutdown
  hooks. The repo's last scattered `process.env` in `src/` is gone.
- `src/prisma/` — `PrismaService` (extends `PrismaClient`; lazy connect,
  clean disconnect), `PrismaModule` (explicit imports, no `@Global`),
  three repositories implementing the *existing* repository interfaces,
  `mappers.ts` (pure row → contract functions), `prisma-errors.ts`
  (`isPrismaError` translation helper).
- `SkillInUseError` added to the `SkillRepository` contract;
  `SkillsService.delete` maps it to an HTTP 409. This is the milestone's
  one deliberate behavior change (see Why).
- Module wiring swapped: `{ provide: SKILL_REPOSITORY, useClass:
  PrismaSkillRepository }` and the equivalents for employees and shifts.
  Controllers and services: **unchanged**. In-memory classes remain, as
  the doubles unit tests use.

**Tests (api suite: 41 → 57 tests)**

- 11 integration tests running the real Prisma repositories against the
  real test database inside the normal `pnpm test` (retrying connect with
  an actionable error, `TRUNCATE ... CASCADE` reset between tests).
- 4 mapper unit tests (no database needed — the mappers are pure).
- 1 service unit test proving `SkillInUseError` → 409.
- Jest loads `apps/api/.env` via a `setupFiles` hook (`dotenv`, quiet).

**CI and docs**

- `.github/workflows/ci.yml`: Postgres 16 service container, database env
  vars, and a `migrate deploy` step before `pnpm test`.
- `docs/DATABASE.md` grew the full setup handbook (§9–§15: compose,
  schema, env config, migration workflow, the swap, and the milestone's
  "What I learned"); `docs/ARCHITECTURE.md` "Where to look next" updated
  plus M2 lesson highlights; README Getting Started now includes Docker
  and the migrate step; `docs/ROADMAP.md` flipped to M2 done / M3 next.

### When

- **Completed 2026-09-01**, in a single working session, immediately after
  Milestone 1 was verified (2026-08-31) — the roadmap sequencing rule
  (nothing new starts while anything is unfinished) kept M1 fully green
  before this began.
- Sequence of the session: Docker compose first (databases running before
  any code depended on them) → Prisma packages and build approvals →
  schema → first migration (create-only, hand-edited SQL, then applied) →
  typed config → PrismaService/Module → repositories and the wiring swap →
  tests → CI → live verification → documentation and roadmap flip.
- Notable timing facts: the port conflict surfaced on the very first
  `docker compose up` (host 5432 was occupied by another project's
  container — dev DB moved to 5434). The live persistence smoke test
  (create entities → restart the api → read identical data back) passed
  with no code changes needed after the swap was complete.

### Why

- **Why this milestone exists at all:** the in-memory repositories lost
  every byte of data on restart and could never be shared by more than one
  api instance. Everything later in the roadmap — the solver reading real
  data, the frontend showing it — stands on persistence.
- **Why Prisma 6 and not 7:** Prisma 7 (November 2025) is a ground-up
  rewrite — Rust-free client, mandatory driver adapters, an ESM-first
  generator, `prisma.config.ts`. That combination fights this repo's
  CommonJS Jest/ts-jest toolchain. Same class of conflict as
  `@nestjs/swagger@12`, resolved the same way: pin the compatible major,
  no toolchain workarounds.
- **Why two containers instead of one database with two schemas:**
  physical isolation. Tests can never touch dev data because they cannot
  even reach it; the test container has no volume, so its state is
  disposable by design.
- **Why explicit join tables:** the API contract carries
  `skillIds: string[]` and `requiredSkillIds: string[]`; relational
  databases express those arrays as rows, and rows are what foreign keys
  can protect. The composite primary keys make duplicate pairs impossible.
- **Why the hand-added `lower(name)` index:** skill names must be unique
  case-insensitively (a Milestone 1 service rule). A generated `@unique`
  index would still allow "Barista" *and* "barista". The expression index
  enforces the real rule at the storage layer — even under concurrent
  requests — while the service keeps giving the friendly 409 first.
- **Why deleting a referenced skill is now a 409:** before, the delete
  silently succeeded and left dangling `skillIds` — corrupted input
  waiting to bewilder the Milestone 3 solver. The database (foreign keys,
  ON DELETE RESTRICT) now refuses; the repository translates Prisma's
  `P2003` into the typed `SkillInUseError`; the service decides the user
  sees a 409. Storage enforces, repository translates, domain speaks —
  three layers, each with exactly one job.
- **Why lazy connection and no `@Global` module:** compiling a module in a
  test must never require a running database, and every module must stay
  self-contained (the property `module-wiring.spec.ts` protects). Both
  choices keep the test suite hermetic.
- **Why integration tests live inside the normal `pnpm test`:** the
  roadmap's acceptance criterion is that the standard suite includes them.
  Making the database a prerequisite of `pnpm test` is honest — the suite
  fails loudly with instructions rather than skipping silently.
- **Why the `SolveJob` table ships now:** the first migration commits the
  schema shape whole, so Milestone 4 adds code, not structure. The table
  is deliberately unused until then.
- **Why so much documentation:** this is a learning repository — the
  milestone's second deliverable is the explanation of itself.

---

## Milestone 3 — Optimization core: the scheduling model

### What

**The model (all in `apps/optimizer/src`, all pure except the adapter)**

- `schedule-model.ts` — `buildScheduleModel(problem, config)`: builds the
  mixed-integer model as CPLEX LP text plus a variable registry mapping
  LP names (`x_0_3`) back to real ids. Binary variable per eligible
  employee–shift pair; constraints for exact shift headcount, weekly
  contract caps, and weekend fairness (`maxweekend ≥ each employee's
  weekend count`); objective = assigned minutes + `fairnessWeight ·
  maxweekend`. Skills, availability, and "cap fits the shift" are enforced
  by **variable pruning**, documented in the JSDoc header alongside the
  objective, constraints, and the honest note that the cost term is
  constant under exact coverage.
- `diagnose.ts` — `diagnose(problem)`: pure infeasibility diagnoser with
  two provable families — per-shift eligible pool vs headcount, and total
  demand minutes vs total contract capacity — producing actionable,
  minutes-and-day-index messages (time formatting stays with the
  frontend).
- `highs-solver.ts` — `runHighs(lpText, config)`: the only file that knows
  HiGHS. Cached WASM loader; `time_limit` (ms→seconds), `mip_rel_gap`,
  `output_flag: false`; status mapping `Optimal`→optimal,
  `Time limit reached`→feasible, infeasible statuses→infeasible,
  **anything else throws**.
- `solve-schedule.ts` — `solveSchedule(problem, config?)`: diagnose →
  empty-problem guard → build → solve → extract assignments (primal >
  0.5) → verify every shift got exactly its headcount before returning →
  `SolveOutcome`. Undiagnosed infeasibility gets an honest "jointly
  contradictory" message, never a fabricated culprit.
- `types.ts` — `ScheduleProblem`/employee/shift, `Assignment`,
  `SolveOutcome` now carries `assignments`, `DEFAULT_SOLVER_CONFIG`
  (10s, 1% gap, weight 1) with reasons on every value.
- `index.ts` is now a pure export hub (M4's HTTP layer imports
  `solveSchedule`); the self-check runner moved to `main.ts` (dev script
  updated) so importing the package has no side effects.

**Tests — 20 optimizer tests, all expectations hand-computed first**

- `solve-schedule.test.ts` (8): the numerical proof set — objective 240
  (single shift), 480 (skill pruning), 241 (weekend fairness penalty),
  481 (two weekend shifts balanced one per employee), 480 (cap exactly
  consumed), plus headcount-shortfall and capacity infeasibilities with
  structured conflicts, and the no-shifts guard.
- `schedule-model.test.ts` (6): the **exact** generated LP text asserted
  character-for-character; registry round-trip; weekend rows; pruning;
  headcount cover rows; the no-eligible-employees guard.
- `diagnose.test.ts` (5): healthy → `[]`, both conflict families with
  message content checks, demand == capacity boundary.

**Docs**

- `docs/OPTIMIZATION.md` — the plain-language MIP tutorial: variables/
  constraints/objective from scratch, our real generated model walked
  through line by line, the fairness linearization, the pipeline, the
  infeasibility philosophy, and the milestone's "What I learned".
- `docs/ARCHITECTURE.md` "Where to look next" now points at the model;
  M3 lesson highlights added. README docs index lists OPTIMIZATION.md.
- `docs/ROADMAP.md` flipped (this section).

### When

- **Completed 2026-09-01**, in a single working session, immediately after
  Milestone 2 (same day). Sequence: types and HiGHS ambient declarations →
  pure model builder (with its exact-LP test) → diagnoser → solver
  adapter → orchestrator and entry-point split → numerical tests → full
  gate → docs and roadmap.
- Notable timing facts: all 20 optimizer tests passed on the **first
  run** — the hand-computed expectations (240 / 480 / 241 / 481 and the
  balanced 1/1 weekend split) matched HiGHS exactly, which is the
  milestone's core acceptance criterion. The ambient `highs.d.ts`
  declaration and option names were verified against the installed
  package's own `types.d.ts` before any code was written, which is
  probably why nothing fought back.

### Why

- **Why LP text as the model exchange format:** the installed `highs`
  package's API takes exactly that — and it is human-readable, so the
  generated model can be asserted character-for-character in tests and
  read line-by-line in `docs/OPTIMIZATION.md`. The model file doubles as
  documentation.
- **Why pruning instead of `x = 0` constraints:** fewer variables means a
  smaller, faster MIP, and the rules become construction guarantees rather
  than solver-enforced promises.
- **Why min-max weekend fairness:** "balanced weekends" is not linear.
  One auxiliary variable plus one row per employee gives a fully linear
  proxy with a clear meaning (minimize the worst-off employee's weekend
  count) — the simplest honest formalization, configurable through
  `fairnessWeight`.
- **Why the cost term stays despite being constant:** it states the
  product intent and becomes meaningful the moment shifts gain individual
  costs (pay rates). The degeneracy is documented rather than hidden —
  pretending "minimize assigned hours" chooses schedules would be a lie
  waiting to mislead a future maintainer.
- **Why diagnose runs before the solver:** HiGHS says *that*, never *why*.
  The two counting-based families cover the common, actionable causes;
  anything subtler gets an honest joint-contradiction message. A wrong
  explanation would be worse than a vague one.
- **Why unknown solver statuses throw:** a schedule returned to users
  must be provably valid; mapping an unrecognized state to "here's a
  schedule" would be silent corruption. Same philosophy as the coverage
  safety net before returning.
- **Why optimizer-local types (not `packages/contracts` yet):** the
  roadmap places solve contracts at the API boundary in Milestone 4; M3's
  types are internal and M4 will map them, keeping the optimizer free of
  HTTP concerns for one more milestone.
- **Why the entry-point split:** `index.ts` became the export surface and
  `main.ts` the standalone self-check runner, so Milestone 4 can import
  the optimizer without triggering side effects.

---

## Milestone 4 — Orchestration: the async solve job

### What

**Contracts (packages/contracts)**

- `solveAssignmentSchema`, `solveResultSchema` (discriminated union:
  `optimal`/`feasible` with `objectiveValue` + `assignments`, `infeasible`
  with ≥1 `conflicts`), `solveRequestSchema` (reuses the full
  employee/shift entities), and `solveJobSchema` extended with an optional
  `result`. One schema serves the optimizer's HTTP response, the stored
  job result, and the api's polling response.

**Optimizer (apps/optimizer)**

- `src/http-server.ts` — the model-server face (ADR-002 realized): a
  dependency-free `node:http` server, `POST /solve` (validate with
  `solveRequestSchema` → `solveSchedule` → respond `solveResultSchema`),
  `GET /health`, the repo's error envelope on 4xx/5xx. `main.ts` boots it
  on `OPTIMIZER_PORT` (default 3002); `start` script added.
- Depends on `@scheduler/contracts` now — the first package-to-package
  contract consumption on the optimizer side.
- Tests: 6 HTTP tests over real localhost on an ephemeral port (solve,
  infeasible, invalid shape, non-JSON, health, 404).

**API (apps/api)**

- `src/solves/optimizer-client.ts` — `OPTIMIZER_CLIENT` DI token +
  `OptimizerClient` interface + `HttpOptimizerClient` (global `fetch`,
  30s ceiling above the optimizer's own 10s solve limit, response parsed
  against the shared contract). The only api file that knows the optimizer
  is HTTP.
- `src/solves/solves.service.ts` — the job lifecycle: validate referenced
  skills exist (400 otherwise) → insert `queued` → fire-and-forget
  `runJob` (`queued → running → terminal`, total error catch mapping
  anything to `failed` + message) → `findById` for polling, re-validating
  the stored result JSON through `solveJobSchema`.
- `src/solves/solves.controller.ts` — `POST /api/solves` (201, instant)
  and `GET /api/solves/:id`, fully documented in Swagger (visible at
  `/api/docs`).
- Migration `20260901124134_add_solve_result`: `SolveJob.result Json?`,
  applied to dev and test databases.
- `OPTIMIZER_BASE_URL` added to the validated env schema, `.env.example`,
  CI env, and Turbo `globalEnv`.
- Tests: 6 service unit tests (hand-stubbed Prisma + client: queued
  snapshot, optimal path, infeasible path, failed path, unknown-skill 400,
  unknown-id 404), the module-wiring graph extended, and the end-to-end
  integration test (real DB + real HTTP client against a contract-valid
  optimizer stub server: instant `queued` acceptance, then polling to
  `optimal` with assignments / `infeasible` with conflicts).
- Jest now runs with `maxWorkers: 1`: the two integration suites share one
  test database, and parallel files truncated each other's rows mid-test.

**Docs**

- ADR-005 (in-process jobs; BullMQ/Redis deliberately deferred, upgrade
  path documented), ARCHITECTURE pointers + M4 lessons, OPTIMIZATION.md
  "what comes next" refreshed, this report, ROADMAP flip.

### When

- **Completed 2026-09-01**, in a single working session, immediately after
  Milestone 3 (same day). Sequence: contracts → optimizer HTTP layer →
  migration → env + typed client → SolvesModule → unit + wiring tests →
  end-to-end integration test → full gate → live smoke test → docs.
- Notable timing facts: the live acceptance run measured `POST /api/solves`
  at **7 ms** (instant `queued`) with polling reporting `optimal` in well
  under a second — objective 241, exactly the hand-computed fairness value
  for a Saturday shift. Two environment collisions surfaced: port 3001 was
  occupied by another project's container (optimizer moved to 3002, same
  lesson as Milestone 2's 5432→5434), and the shared test database made
  parallel Jest workers interfere (fixed with `maxWorkers: 1`).

### Why

- **Why a job row instead of holding the request open:** HTTP connections
  time out, carry no progress, and die with the client. A row in Postgres
  is durable, pollable, restart-survivable state — and it was already
  prepared by Milestone 2's migration.
- **Why fire-and-forget with a total catch:** the pattern's real content
  is failure discipline. Every branch must terminate the row (`failed` +
  message) — an unhandled rejection would crash the process, and a silent
  one would strand a job in `running` forever.
- **Why no BullMQ yet (ADR-005):** a queue adds Redis and operational
  weight with no benefit for a single api instance and sub-second solves.
  `runJob` is public precisely so a future worker calls the same code;
  the swap is one line at one call site.
- **Why the optimizer uses `node:http` instead of Nest:** one POST route
  and one health route — the standard library covers it, zero new
  dependencies, and the validation still comes from the shared zod
  contracts. The industry model-server pattern does not require a
  framework.
- **Why the client parses the response with the contract:** trust
  boundaries run in both directions — a misbehaving optimizer must not be
  able to smuggle a wrong shape into the job row any more than a
  misbehaving client should into the solver.
- **Why the api validates referenced skills before accepting a job:** the
  optimizer matches skill ids only between employees and shifts; a typo'd
  id would produce a schedule that is silently wrong. The 400 surfaces it
  at the boundary where the user can fix it.
- **Why `maxWorkers: 1`:** one test database + parallel Jest files =
  nondeterministic truncation of each other's rows. Serializing files
  trades seconds of suite time for determinism.
- **Why the optimizer moved to port 3002:** 3001 was occupied by another
  project's container on this machine. Ports are a shared machine
  resource — adapt our own config, never touch another project's process.

---

## Milestone 5 — Frontend integration: forms, calendar, polling

### What

**Foundation (apps/web)**

- shadcn/ui initialized (the 2025 CLI with the radix/nova style) into
  `src/ui/`: button, input, label, select, field, card, badge, skeleton,
  table + separator. Tailwind v4 theme tokens completed by the init
  (oklch neutral palette, dark block, Geist font). The unified `radix-ui`
  package and the CLI's own Tailwind runtime (`shadcn` package) are the
  two new runtime deps; sonner/next-themes were installed by the CLI and
  deliberately removed (a Next.js theme hook has no place in this Vite
  app; inline `role="alert"` errors are clearer). ESLint got the
  canonical shadcn override (`react-refresh/only-export-components` off
  for `src/ui`).
- `lib/api-client.ts` — `apiFetch(path, schema, init)`: the single UI↔api
  boundary; non-2xx becomes an `ApiError` built from the api's error
  envelope, every success response is zod-parsed against the shared
  contracts. `use-health` migrated to it.
- `lib/time.ts` + 9 tests — the single shared time utility (day names,
  minute-of-day formatting, "HH:MM" parsing, shift-window labels, weekly
  hours), throwing loudly on impossible inputs.
- `lib/test-utils.tsx` — `renderWithProviders` (fresh QueryClient without
  retries + MemoryRouter); Radix jsdom stubs in `vitest.setup.ts`;
  `NODE_ENV: 'test'` pinned in the Vitest config (React 19.2 dropped
  `act` from its production build — an ambient production NODE_ENV broke
  every component test).

**Features**

- `features/skills/` — list + create form + page + test (the roadmap
  names employees/shifts/schedule, but the journey starts with skills).
- `features/employees/` — list + create form (skill checkboxes, dynamic
  availability windows with day Select + time inputs, weekly hours input)
  + page + 3 tests; "08:00" becomes `startMinute: 480` via `lib/time.ts`
  and is re-validated by `employeeCreateSchema.parse` before submit.
- `features/shifts/` — list + create form (day Select, time inputs,
  required-skill checkboxes, headcount) + page + 2 tests with the same
  conversion-and-parse pattern.
- `features/schedule/` — `useSolveMutation` (POST /api/solves),
  `useSolveJob` (polls every second while queued/running, stops when
  terminal), a Zustand store persisting only `activeJobId` to
  sessionStorage, and `SchedulePage` with views for every lifecycle
  state: no-job hint, queued/running skeletons with status badge,
  `optimal`/`feasible` (calendar + objective score), `infeasible` (red
  card listing every conflict), `failed` (message + retry).
  `ScheduleCalendar` renders employees × Monday–Sunday with shift chips.
- Routing: `/skills`, `/employees`, `/shifts`, `/schedule` + active-state
  nav in `App.tsx`.
- 23 web tests total (time utility, three form/list journeys, and five
  schedule-page state tests) — all hermetic, fetch stubbed per test, no
  mock-server dependency.

### When

- **Completed 2026-09-01**, in a single working session, immediately after
  Milestone 4 (same day). Sequence: shadcn base → api client + test utils
  → time utility → skills → employees → shifts → schedule plumbing →
  schedule page + calendar → gate → live journey → docs.
- Notable timing facts: the live journey accepted a solve in **16 ms**
  and polled to `optimal` with objective 241 (the hand-computed value for
  a Saturday shift), with the Vite `/api` proxy verified end to end.
  Docker Desktop was found shut down when the integration suites' hooks
  timed out — resolved by starting it and giving the two integration
  `beforeAll` hooks explicit 15s timeouts so the retry message can
  surface instead of a hook-timeout wall.

### Why

- **Why the shadcn CLI (and the field/sonner divergence):** the canonical
  workflow teaches the real toolchain. The 2025 registry renamed `form`
  to `field`-style composition; this repo's forms use plain Label/Input
  with inline alerts — simpler to read, test, and explain. sonner (and
  its Next.js-only `next-themes` dependency) was removed as scope the UI
  didn't need.
- **Why `src/ui/` not `src/components/ui/`:** AGENTS.md's frontend section
  names `ui/` as the home of presentational components; `components.json`
  aliases were updated so future CLI adds land in the same place.
- **Why a shared `apiFetch`:** with ~8 endpoints, the dashboard's inline
  fetch+parse would repeat eight times; one boundary keeps the
  "every response is contract-validated" rule true by construction, and
  error envelopes surface with the api's own message.
- **Why forms speak "HH:MM" but the contract speaks minutes:** `<input
  type="time">` produces strings; the widget's unit must not leak into
  the domain. The conversion happens in one place (`lib/time.ts`), and
  the shared create schema re-parses the mapped object — the contract
  stays the boundary on both sides of the request.
- **Why Zustand only for `activeJobId`:** it is the only state whose
  owner is the UI. Persisting it to sessionStorage means a refresh during
  a running solve resumes polling instead of orphaning the job view.
- **Why polling via `refetchInterval` reading `query.state.data`:** the
  interval is a *function* of the current status — 1s while
  queued/running, stopping at terminal — the whole lifecycle in one hook,
  no effect wiring, no stale timers.
- **Why the infeasible view is a first-class screen:** the solver's
  conflict explanations (Milestone 3) are the product's differentiator;
  burying them in a generic error would waste them. The red card lists
  each reason verbatim.
- **Why the time utility throws:** display code with wrong units produces
  plausible garbage ("40:00" for a 40-hour cap). A loud RangeError during
  the milestone did exactly its job — it caught the bug at the only place
  it could exist.

---

## Milestone 6 — Hardening: auth, E2E, containers, polish

### What

**Authentication (apps/api)**

- `packages/contracts`: `registerSchema`, `loginSchema`, `authResponseSchema`
  added to the shared contracts.
- `apps/api/prisma/schema.prisma`: `User` model (id, email unique,
  passwordHash, name, createdAt). Migration `20260902130654_add_user`
  committed and applied.
- `apps/api/src/auth/` module:
  - `AuthService` — register (bcrypt hash, 10 rounds) and login (verify
    credentials). Returns JWT + user object.
  - `AuthController` — `POST /api/auth/register`, `POST /api/auth/login`
    (both `@Public()`).
  - `JwtStrategy` — extracts Bearer token from Authorization header,
    verifies with JWT_SECRET, attaches user to request.
  - `JwtAuthGuard` — global guard via `APP_GUARD`; skips `@Public()` routes.
  - `Public` decorator — marks routes as public.
- All GET endpoints marked `@Public()` (skills, employees, shifts, solves,
  health). All write endpoints (POST, PATCH, DELETE) require JWT.
- `env.schema.ts` updated with `JWT_SECRET` (min 32 chars).
- `.env.example`, `.env`, `turbo.json`, `docker-compose.yml` updated.
- Swagger config updated with `.addBearerAuth()`.
- Dependencies: `@nestjs/jwt`, `@nestjs/passport`, `passport`,
  `passport-jwt`, `bcryptjs`, `@types/passport-jwt`, `@types/bcryptjs`.

**Containers**

- `apps/api/Dockerfile` — multi-stage build: build stage (pnpm install,
  prisma generate, tsc) → production stage (production deps, prisma
  migrate deploy at startup via entrypoint script).
- `apps/optimizer/Dockerfile` — multi-stage build: build stage → production
  stage with HiGHS WASM binaries.
- `apps/web/Dockerfile` — multi-stage build: Vite build → nginx:alpine
  serving the SPA.
- `apps/web/nginx.conf` — SPA routing (try_files → index.html) + `/api`
  proxy to api:3000.
- `docker-compose.yml` — full stack: db, api, optimizer, web + test-db for
  local development.
- `.dockerignore` — excludes node_modules, dist, .git from build context.
- `apps/api/docker-entrypoint.sh` — finds prisma binary in pnpm store,
  runs migrations, starts API.
- `packages/contracts/package.json` — added `"node"` export condition for
  production ESM resolution.
- `apps/optimizer/src/http-server.ts` — changed bind address from
  `127.0.0.1` to `0.0.0.0` for Docker networking.
- `apps/api/package.json` — moved `prisma` from devDependencies to
  dependencies (needed for production migrations).

**E2E Tests**

- `playwright.config.ts` — Chromium browser, base URL localhost:5173,
  auto-starts Vite dev server.
- `e2e/schedule-journey.spec.ts` — 7 tests: register/login via API, view
  skills/employees/shifts/schedule pages, create skill via UI, trigger
  solve via API and verify result.
- Root `package.json` — added `test:e2e` script.

**Polish**

- `apps/api/src/auth/auth.service.spec.ts` — 5 unit tests for auth service
  (register, login, duplicate email, invalid credentials).
- `apps/api/jest.config.json` — updated coverage config, added
  `moduleNameMapper` for `@nestjs/jwt` mock.
- API coverage: 82.63% statements (above 80% target).
- `docs/DEPLOYMENT.md` — Docker deployment guide from scratch.
- `docs/adr/006-auth-choice.md` — ADR for JWT + bcrypt choice.
- `docs/ARCHITECTURE.md` — added auth and container sections.
- `README.md` — updated with Docker quick start, auth instructions,
  E2E test command.
- `docs/ROADMAP.md` — Milestone 6 marked as complete.

### When

- **Completed 2026-09-02**, in a single working session, immediately after
  Milestone 5 (previous day). Sequence: Dockerfiles → compose stack →
  auth contracts → User model → auth module → controller updates →
  Playwright setup → E2E tests → coverage improvements → documentation.
- Notable timing facts: the Docker build exposed that Prisma's postinstall
  needs the schema file (fixed by copying it early), and that the
  contracts package's ESM exports pointed to TypeScript source (fixed by
  adding a `"node"` condition). The optimizer's `127.0.0.1` bind address
  prevented inter-container communication (fixed by changing to `0.0.0.0`).

### Why

- **Why JWT and not sessions:** JWT is stateless — no session store to
  manage, no sticky sessions needed. For a single-instance API, this is
  simpler. The tradeoff (can't revoke tokens before expiry) is acceptable
  for a learning project.
- **Why bcrypt and not argon2:** bcrypt's npm package is pure JS (no
  native builds), avoiding platform-specific install issues. For a
  learning project, bcrypt's security is more than sufficient.
- **Why a global guard:** "secure by default". New endpoints are protected
  automatically; forgetting `@Public()` on a read endpoint is a minor
  inconvenience, not a security hole.
- **Why multi-stage Docker builds:** keeps production images small (no
  TypeScript compiler, no dev dependencies) while the build stage has
  everything it needs.
- **Why nginx for the web container:** nginx is the industry standard for
  serving static files. It handles SPA routing (try_files → index.html)
  and can proxy API requests, all with minimal configuration.
- **Why Playwright for E2E:** it's the modern standard for browser
  testing, with better debugging and cross-browser support than Cypress.
  The critical journey test verifies the full stack works end-to-end.


