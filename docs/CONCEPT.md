# Project Concept & Implementation Plan

What this project is, what problem it solves, and how the pieces fit
together — written for a reader with frontend experience and no background
in optimization or backend engineering. This is the narrative overview;
the live progress lives in [ROADMAP.md](./ROADMAP.md), and each milestone's
deep teaching guide lives in its own document (e.g.
[DATABASE.md](./DATABASE.md)).

---

## 1. The problem it solves

**Staff shift scheduling** — a genuinely painful real-world problem. A
manager has:

- **Employees**, each with skills ("barista", "cashier"), availability
  windows (when they can work), and contract limits (max hours per week).
- **Shifts** that must be covered — each needs a certain headcount of
  people with specific skills at a specific time.

The manager must answer one question: *who works which shift?*

Done by hand, this is miserable and error-prone. You produce a schedule
that violates someone's availability, or assigns an untrained person to
the espresso shift, or quietly overworks one employee while another sits
idle. The core difficulty: **the rules interact**. Fixing one conflict
creates another, and no human can hold all combinations in their head.

The project's answer: model the rules as mathematics, and let a **solver**
— a program built to search millions of combinations — find an assignment
that satisfies *every* rule while optimizing a goal (minimize assigned
hours, balance weekend load). And when the rules contradict each other
(no Barista is available Saturday), the product must *explain that
honestly* instead of silently producing a broken schedule.

---

## 2. The concept: mathematical optimization

Optimization is **declarative** — you state *what* you want, never *how*
to find it. A model has three parts:

- **Variables** — the decisions we get to make. Here: "does employee E
  cover shift S?" — a yes/no question, so a **binary** variable (1 or 0).
- **Constraints** — the rules, written as equations the variables must
  satisfy: every shift meets its headcount; only matching skills; only
  within availability; nobody exceeds contract hours.
- **Objective** — a single number we want to make as good as possible:
  total assigned hours plus a configurable fairness penalty (e.g. balanced
  weekend load).

The solver — **HiGHS**, a production-grade optimization engine (the same
family of engines powering Google's OR-Tools), compiled to WebAssembly so
it runs in Node — searches the space of all assignments and returns the
best one that satisfies every constraint.

> Frontend analogy: constraints are your form validation rules; the
> objective is your design goal ("fewest clicks"); the solver is a compiler
> that finds *any* valid assignment that optimizes the goal. You declare
> what you want — the how is the solver's problem.

### The three honest outcomes

Every solve ends in exactly one of three states:

- **optimal** — the best schedule was found *and proven best*. The solver
  mathematically certifies that nothing better exists.
- **feasible** — a valid schedule exists, but the solver hit its time
  limit before proving optimality. Usable; possibly not the cheapest.
- **infeasible** — *no* schedule satisfies every rule. The rules
  contradict each other. This is a first-class, user-facing result: the
  product must explain *which* constraints conflict ("Saturday 9am needs a
  Barista, but every Barista is off that morning") so the manager can fix
  the input.

This honesty about infeasibility is what separates a real optimization
product from a demo. Real-world inputs are often over-constrained.

---

## 3. The architecture: three services, one job each

```
┌────────────┐   REST/JSON   ┌────────────┐   HTTP   ┌──────────────────┐
│  apps/web  │ ─────────────▶│  apps/api  │ ───────▶ │ apps/optimizer   │
│  React SPA │               │  NestJS    │          │ Node + HiGHS.js  │
└────────────┘               └─────┬──────┘          └──────────────────┘
                                   │
                                   ▼
                           PostgreSQL (Prisma)
```

This is the industry **model-server pattern** — the optimization engine
runs as its own service, separate from everything else:

- **apps/web** — React 19 SPA: forms and the calendar UI. Never does math
  beyond trivial UI logic.
- **apps/api** — NestJS REST API: endpoints, business rules, persistence,
  orchestration. When a solve is requested it returns a **job id**
  immediately (solves take seconds; an HTTP request must never block that
  long) and clients **poll** for the result.
- **apps/optimizer** — Node + HiGHS.js: *all* mathematical modeling lives
  here as pure functions (typed inputs → typed results, no I/O). Isolation
  means a slow solve never blocks the UI, the solver is swappable without
  touching anything else, and the math is unit-testable against
  hand-computed cases.
- **packages/contracts** — shared zod schemas. Every API shape is defined
  once and validated on both sides of the HTTP boundary (contract-first
  workflow).

The web app talks only to the api; the api talks to the optimizer and the
database. One entry point means one place to enforce rules.

---

## 4. The implementation plan

Six milestones, sequenced as a learning path. Each milestone finishes with
its acceptance criteria verified and a "What I learned" summary; the
feature sequencing rule (finish and stabilize before starting new work)
applies throughout.

### Milestone 0 — Scaffold — DONE

Monorepo (pnpm workspaces + Turborepo), three services + shared packages,
CI on every PR, docs, and a HiGHS.js self-check solving a tiny LP to its
hand-computed optimum.

### Milestone 1 — Backend foundation — DONE

Contract-first CRUD for skills, employees, and shifts: repository
interfaces with in-memory implementations, services holding business rules
(unique skill names, referential integrity, merged-entity validation),
thin controllers, a global exception filter returning the contracted
`{ statusCode, message, details }` envelope. 41 tests, including a
module-wiring test that compiles the real NestJS module graph.

### Milestone 2 — Database — NEXT

Real persistence: PostgreSQL via Docker (dev + test databases), Prisma
schema + migrations, and Prisma repositories swapped in behind the
existing interfaces — controllers and services untouched, which is the
whole payoff of the layering. Integration tests against the test database.
Teaching guide: [DATABASE.md](./DATABASE.md).

### Milestone 3 — Optimization core

The real scheduling model in `apps/optimizer`: binary assignment
variables, coverage/skill/availability/hour constraints, fairness-weighted
objective, the three typed outcomes, and infeasibility explanations.
Numerical tests against hand-computed small cases — including a
deliberately infeasible one. Teaching guide: `OPTIMIZATION.md` (written
with the milestone).

### Milestone 4 — Orchestration

The async solve job: `POST /api/solves` validates the problem, stores a
job row (`queued`), calls the optimizer over HTTP via a typed client,
updates the row (`running` → `optimal|feasible|infeasible|failed`), and
returns the job id instantly; `GET /api/solves/:id` reports status.
Contracts for the solve request/response/job in `packages/contracts`. A
real queue (BullMQ) is deliberately deferred — noted in an ADR.

### Milestone 5 — Frontend integration

Everything connects end to end: shadcn/ui forms validated with the shared
zod schemas, TanStack Query hooks with key factories, the solve-and-poll
flow, a weekly calendar (employee × day grid with shift chips), and a
dedicated infeasibility view listing the conflicting rules.

### Milestone 6 — Hardening

What separates a demo from a production-grade product: JWT auth (register/
login + guards on write endpoints), Playwright E2E for the critical
journey, Dockerfiles + compose for the whole stack, CI image builds and
E2E, coverage on api/optimizer at least 80%.

---

## 5. Cross-cutting rules

- **Contract-first**: API shape changes start in `packages/contracts`.
- **Time as minutes-since-week-start** everywhere outside the frontend;
  display formatting only in the UI via one shared utility.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green before
  any commit; commits/pushes only when explicitly requested.
- New dependencies need a stated reason.
- Every milestone ends with a thorough plain-English "What I learned".
