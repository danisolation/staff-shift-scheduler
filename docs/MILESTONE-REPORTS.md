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

