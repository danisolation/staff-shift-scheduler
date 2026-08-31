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
