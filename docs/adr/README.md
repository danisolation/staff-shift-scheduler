# Architecture Decision Records

Short, dated records of significant technical decisions. ADRs preserve *why*
decisions were made, so future readers (including future you) don't have to
guess.

## ADR-001: TypeScript everywhere, no Python

**Date:** 2026-08-31 · **Status:** Accepted

**Context.** The optimization engine could be written in Python (FastAPI +
OR-Tools), which is the most common industry choice. The project owner is a
front-end developer who does not write Python.

**Decision.** The whole stack — including the optimizer — is TypeScript. The
solver is HiGHS.js, a WebAssembly build of the HiGHS MIP/LP solver (same
engine used in production tools like OR-Tools' own backend).

**Consequences.** One language to read, learn, and review everywhere. The
solver library ecosystem in TypeScript is smaller than Python's, but HiGHS.js
wraps a production-grade C++ engine, so modeling power is not sacrificed.

## ADR-002: The optimizer is a separate service, not a library

**Date:** 2026-08-31 · **Status:** Accepted

**Context.** The optimizer could be an npm package imported directly by the
api.

**Decision.** The optimizer is its own Node service that the api calls over
HTTP (the industry "model server" pattern).

**Consequences.** Long solves never block the api; each service scales and
deploys independently; a future swap to a dedicated solver backend touches
only the optimizer.

## ADR-003: pnpm workspaces + Turborepo

**Date:** 2026-08-31 · **Status:** Accepted

**Context.** The project spans 5+ packages (web, api, optimizer, contracts,
config) that must be built in dependency order.

**Decision.** pnpm workspaces for local package linking and Turborepo for
task orchestration and caching.

**Consequences.** One `pnpm install` sets up everything; one `pnpm build`
builds everything in the right order with caching; CI and local runs share
the same commands.

## ADR-004: Shared zod contracts define the API surface

**Date:** 2026-08-31 · **Status:** Accepted

**Context.** API shapes must stay consistent between the web app and the api.

**Decision.** All DTOs are zod schemas in `packages/contracts`, imported by
both sides. Changes start in contracts and ripple outward.

**Consequences.** Runtime validation on both sides from one source of truth;
TypeScript types are derived from the schemas, so no duplicate type
definitions.

## ADR-005: Solve jobs run in-process; a real queue is deferred

**Date:** 2026-09-01 · **Status:** Accepted

**Context.** A solve can take seconds, and HTTP requests must never block on
it (`POST /api/solves` must answer instantly). The industry answer is a job
queue (BullMQ + Redis, Sidekiq-style). But a queue is another moving part:
a Redis server, worker processes, new failure modes — for a product whose
solves are currently sub-second.

**Decision.** The api owns the whole lifecycle in one process: `POST
/api/solves` validates, inserts a `SolveJob` row (`queued`), fires the work
in the background (`void runJob(...)`), and answers `201 { jobId }` at once.
The background run transitions the row (`running` → terminal status) and
catches *everything* — a job can end `failed` but never stuck, and no
unhandled rejection can crash the process. Clients poll `GET /api/solves/:id`.
The job row is the single source of truth; `runJob` is public because a
future queue worker would call exactly it.

**Consequences.** Zero new infrastructure (no Redis), the flow is fully
testable (unit tests stub the optimizer client; an integration test drives
the real lifecycle), and the status history lives in Postgres like every
other entity. The trade-off, accepted for now: jobs execute only inside the
api process — a crash loses in-flight work (the row stays `running`), and
multiple api instances would each run their own jobs. When that matters,
swapping `void runJob(...)` for an enqueue is a one-line change at a single
call site; the row state makes workers idempotent.
