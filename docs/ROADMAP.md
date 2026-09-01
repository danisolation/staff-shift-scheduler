# Project Roadmap & Progress

The single source of truth for where this project stands and what comes next.
**Every agent must read this file before starting any task.** Status is
updated here only when a milestone genuinely satisfies its acceptance
criteria and the repo's Definition of Done (`AGENTS.md` section 8) —
including the feature sequencing rule: nothing new starts while anything
is unfinished or buggy.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done (all acceptance criteria verified)

---

## Current state

**Milestone 3 is complete; Milestone 4 is next.** Everything above it is
blocked until it is finished.

- `[x]` Scaffold — monorepo, docs, CI, initial push. Verified: lint,
  typecheck, test, build green; health-check loop and HiGHS.js self-check
  working end to end.
- `[x]` **Milestone 1 — Backend foundation (CRUD for employees, skills, shifts)**
  Verified 2026-08-31: all acceptance criteria hold (see below).
- `[x]` **Milestone 2 — Database (PostgreSQL, Prisma, migrations)**
  Verified 2026-09-01: all acceptance criteria hold (see below).
- `[x]` **Milestone 3 — Optimization core (the scheduling model)**
  Verified 2026-09-01: all acceptance criteria hold (see below).
- `[ ]` Milestone 4 — Orchestration (async solve job)
- `[ ]` Milestone 5 — Frontend integration (forms, calendar, polling)
- `[ ]` Milestone 6 — Hardening (auth, E2E, containers, polish)

## How to update this file

1. Work a milestone until **all** acceptance criteria hold.
2. Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green,
   plus the milestone's own verification steps (e.g. curl smoke tests).
3. Flip its status to `[x]`, flip the next milestone to `[~]`, and update
   "Current state" above so it still names the active milestone.
4. Never commit or push unless the human explicitly asks.

---

## Milestone 1 — Backend foundation: CRUD for employees, skills, shifts

**Concept:** REST endpoints done the contract-first way. Start in
`packages/contracts`, then ripple outward to `apps/api`.

**Scope:**
- Contracts in `packages/contracts`: full `employeeSchema` (name, skills,
  availability windows, contract max hours), `skillSchema`, `shiftSchema`,
  plus create/update input schemas and list response schemas. Time stays
  minutes-since-week-start.
- `apps/api`: in-memory repositories behind interfaces, one module per
  resource (`EmployeesModule`, `SkillsModule`, `ShiftsModule`) with thin
  controllers (`GET`/`POST`/`PATCH`/`DELETE`), services holding business
  rules, `ZodValidationPipe` on every body/param.
- Global exception filter returning the consistent
  `{ statusCode, message, details }` envelope from the contracts.
- Jest unit tests for every service and a controller test per module.

**Acceptance criteria (all required):**
- `pnpm lint && pnpm typecheck && pnpm test` green.
- Manual curl smoke test of every endpoint, including a `400` response on
  invalid input.
- API responses validated against the shared contracts.

**Verified 2026-08-31:**
- Lint, typecheck, test (41 tests), build all green.
- Curl smoke tests passed: skills/employees/shifts CRUD, 201 on create,
  204 on delete, 400 on malformed bodies and bad uuid params, 409 on
  duplicate skill names, 400 on unknown skill references, 404 on missing
  ids, and the contracted `{ statusCode, message, details }` envelope on
  every error.
- Two bugs found and fixed during verification: `SKILL_REPOSITORY` was not
  exported from `SkillsModule` (caught by a new module-wiring test), and
  cross-field validation was missing from create/update paths (caught by
  smoke testing, fixed in the contracts + service merged-validation).

**Docs to update:** `ARCHITECTURE.md` ("Where to look next"), plus the
thorough "What I learned" summary for this milestone.

---

## Milestone 2 — Database: PostgreSQL, Prisma, migrations

**Concept:** real persistence. In-memory repositories get swapped for
Prisma without touching controllers or services.

**Scope:**
- `docker-compose.yml` at repo root: Postgres for dev plus a separate test
  database.
- Prisma schema in `apps/api/prisma/schema.prisma`: `Employee`, `Skill`,
  `Shift`, employee-skill join table, availability windows, `SolveJob`
  table (prepared for Milestone 4). First migration committed.
- Prisma repositories implementing the existing repository interfaces;
  typed `ConfigModule` for env vars (no scattered `process.env`).
- Integration tests against the real test database.

**Acceptance criteria:** endpoints persist across API restarts; `pnpm test`
includes integration tests; migrations committed.

**Docs:** `docs/DATABASE.md` (what a database is, what a migration is, how
Prisma generates the client); "What I learned".

---

**Verified 2026-09-01:**
- Lint, typecheck, test (57 api tests: 41 existing unit tests + 16 new),
  build all green.
- `docker-compose.yml` runs two Postgres 16 containers (dev on host port
  5434 — 5432 was taken by another project's container; test on 5433).
- First migration committed (incl. a hand-added case-insensitive unique
  index on skill names); applied to dev (migrate dev) and test
  (migrate deploy) databases.
- Live smoke test: skills/employees/shifts created via the API, the server
  restarted, and every entity returned with identical data — persistence
  proven. Error paths re-verified live: 400 invalid bodies, 409 duplicate
  skill names, 400 unknown skill references, 400 on merged-shift PATCH
  violations, 404s — and the new 409 when deleting a referenced skill
  (foreign keys refuse; the old behavior silently left dangling ids).
- Prisma repositories implement the existing interfaces; controllers and
  services unchanged. Env validated once at boot via a typed zod
  `ConfigModule`; the last scattered `process.env` in `src/` is gone.
- CI updated: Postgres service container + `migrate deploy` step so the
  integration tests run on every PR.

---

## Milestone 3 — Optimization core: the scheduling model

**Concept:** mixed-integer programming for real — the heart of the project.

**Scope:**
- Pure `buildScheduleModel` function in `apps/optimizer`: binary variable
  `x[e][s]` = employee e covers shift s; constraints: shift headcount,
  skill matching, availability, per-employee max hours; objective: minimize
  assigned hours + fairness penalty (weekend balance) weighted by
  `SolverConfig`. JSDoc header documents objective, constraints, assumptions.
- Map HiGHS results to `SolveOutcome` (`optimal` / `feasible` /
  `infeasible`); infeasible results carry a human-readable conflict
  explanation (structured per constraint family, e.g. which shift's
  headcount is unsatisfiable).
- Numerical tests against hand-computed small cases — including one
  deliberately infeasible case.

**Acceptance criteria:** optimizer tests match hand-computed answers
exactly; infeasible case returns an actionable explanation.

**Docs:** `docs/OPTIMIZATION.md` (plain-language MIP tutorial); "What I
learned".

---

**Verified 2026-09-01:**
- Lint, typecheck, test (20 optimizer tests, all expectations hand-computed
  before running), build all green across the monorepo.
- `buildScheduleModel` produces CPLEX LP text asserted character-for-
  character in tests, with a registry mapping LP variable names back to
  real ids.
- Numerical cases match hand-computed answers exactly: 240 (single shift),
  480 (skill pruning), 241 (weekend fairness penalty), 481 (two weekend
  shifts balanced one per employee via the min-max fairness variable), 480
  (contract cap exactly consumed).
- The deliberately infeasible cases return structured, actionable
  conflicts: headcount 2 with a pool of 1 names the shift and the counts;
  720 demanded vs 480 contracted minutes names both numbers.
- Unknown solver statuses throw rather than masquerade as schedules; every
  returned schedule is verified to satisfy exact shift headcounts.
- `index.ts` is now a pure export hub (`solveSchedule` + types); the
  self-check runner moved to `main.ts`.

---

## Milestone 4 — Orchestration: the async solve job

**Concept:** long-running work must never block an HTTP request.

**Scope:**
- `apps/optimizer` gains an HTTP layer: POST problem → solve → return
  result.
- `apps/api`: `POST /api/solves` validates the problem contract, creates a
  `SolveJob` row (`queued`), calls the optimizer via a typed client module,
  updates the row (`running` → `optimal|feasible|infeasible|failed`), and
  returns the job id immediately. `GET /api/solves/:id` returns status.
  (A real queue like BullMQ is deliberately deferred — note in an ADR.)
- Solve request/response/job contracts in `packages/contracts`.
- Tests: api unit tests with a mocked optimizer client; one integration
  test running a tiny end-to-end solve.

**Acceptance criteria:** `POST /api/solves` returns a job id instantly;
polling eventually reports `optimal` with an assignment result.

**Docs:** ADR on the job pattern; "What I learned".

---

## Milestone 5 — Frontend integration: forms, calendar, polling

**Concept:** everything connects end to end.

**Scope:**
- shadcn/ui primitives in `apps/web/src/ui/` (Button, Input, Select, Form,
  Calendar/Table primitives).
- Feature folders: `features/employees`, `features/shifts`,
  `features/schedule`. Forms validated with shared zod schemas; TanStack
  Query hooks with feature-based key factories; Zustand for pure UI state
  only (e.g. selected week).
- Schedule page: submit solve → poll job → weekly calendar (employee × day
  grid with shift chips), status states for queued/running/optimal/
  feasible, and a dedicated infeasible view listing conflicting rules.
- Component tests with React Testing Library; display formatting stays in
  the frontend via the single shared time utility.

**Acceptance criteria:** full manual journey works — create employees with
skills → create shifts → solve → calendar renders; `pnpm test` green.

**Docs:** README feature list; "What I learned".

---

## Milestone 6 — Hardening: auth, E2E, containers, polish

**Concept:** what separates a demo from a production-grade product.

**Scope:**
- Auth: simple JWT flow in `apps/api` (register/login, guards on write
  endpoints) — simplest correct approach; no OAuth complexity.
- Playwright E2E for the critical journey only.
- Dockerfiles for all three apps + compose wiring web/api/optimizer/Postgres
  into one stack; CI gains an image-build step and the E2E run.
- Polish: README screenshots/setup, ARCHITECTURE update, ADR for the auth
  choice, coverage on api/optimizer at least 80%.

**Acceptance criteria:** fresh clone → `docker compose up` → full journey
works; CI green including E2E.

**Docs:** `docs/DEPLOYMENT.md` (containers from scratch); "What I learned".

---

## Cross-cutting rules (every milestone)

- Contract-first: API shape changes start in `packages/contracts`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green before any
  commit; commits/pushes only when explicitly requested.
- Each milestone ends with a thorough plain-English "What I learned".
- New dependencies need a stated reason in the PR description.
- Time is always minutes-since-week-start outside the frontend.
