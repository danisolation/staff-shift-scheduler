# Architecture

A complete walkthrough of how this system fits together, written for a
reader with frontend experience and no backend background. Every term is
defined the first time it appears, and every section answers *why*, not
just *what*.

Companion reading: [MONOREPO_BASICS.md](./MONOREPO_BASICS.md) explains the
repo setup itself (workspaces, Turborepo, CI). This document explains the
*application* architecture — the three services and how data flows between
them.

---

## 1. The big picture

```
┌────────────┐   REST/JSON   ┌────────────┐   HTTP   ┌──────────────────┐
│  apps/web  │ ─────────────▶│  apps/api  │ ───────▶ │ apps/optimizer   │
│  React SPA │               │  NestJS    │          │ Node + HiGHS.js  │
└────────────┘               └─────┬──────┘          └──────────────────┘
                                   │
                                   ▼
                           PostgreSQL (Prisma)
```

Three services, one job each:

1. **apps/web** — the React SPA (single-page application). Handles UI,
   forms, and visualization. Never does math beyond trivial UI logic.
2. **apps/api** — the NestJS REST API. Handles authentication,
   persistence (saving/loading from the database), and orchestration
   (coordinating the other pieces). When a solve is requested it does not
   do the math itself — it asks the optimizer.
3. **apps/optimizer** — a TypeScript service that owns *all* mathematical
   modeling (variables, constraints, objective, solver calls) using
   HiGHS.js.

The diagram reads: the browser talks only to the api; the api talks to the
database and, when needed, to the optimizer.

## 2. Why three services instead of one?

This is the **model-server pattern**, common in industry. The word
**service** here just means "a program that runs independently and talks
to others over HTTP" — the same way a REST API you call from your frontend
is a service.

The pattern exists because of four problems that appear when you shove
everything into one program:

- **Blocking.** The solver is CPU-heavy: a big scheduling problem can take
  seconds or minutes of full CPU. If it ran inside the api process, a
  solve would freeze the entire API — including the endpoints the UI needs
  just to render. Keeping the solver in its own process means a slow solve
  degrades nothing else.
- **Scaling.** When two parts of a system have very different workloads,
  you want to run *more copies* of one without paying for the other. The
  web-facing API is usually busy but light; the solver is idle most of the
  time but heavy when used. As separate services, each can be scaled (run
  as multiple instances) independently.
- **Swapability.** If a better solver appears in two years, only the
  optimizer changes. The web app and the api never notice.
- **Testability.** Each service is small enough to test in isolation. You
  can test the solver without a database, and the API without a solver.

The rule that makes this work: **the web app never talks to the optimizer
directly.** It only talks to the api. One entry point for the browser
means one place to enforce auth and business rules, and one place to
change if the backend internals change.

> Frontend analogy: this is component separation, applied to processes.
> Your `ui/` components don't know about your `features/` hooks — and
> `features/` doesn't know about `ui/`'s internals. Here the boundary is
> HTTP instead of a function signature.

## 3. Core concepts, defined from scratch

### REST API

**API** = Application Programming Interface: a defined way for two pieces
of software to talk. (In frontend terms, your component props are an API
for your component.)

**REST** is the dominant style of web API. Its idea: model your system as
**resources** (nouns) and act on them with **HTTP methods** (verbs):

| Method | Meaning | Example |
|--------|---------|---------|
| `GET` | Read a resource or list of resources | `GET /api/shifts` — list all shifts |
| `POST` | Create something new | `POST /api/shifts` — create a shift |
| `PATCH` | Update part of an existing resource | `PATCH /api/shifts/123` — edit one shift |
| `DELETE` | Remove a resource | `DELETE /api/shifts/123` — delete one shift |

The "resource" is identified by the URL; the body of the request carries
data. Responses are JSON with an **HTTP status code**:

- `200 OK` — it worked, here is the data
- `201 Created` — it worked, and something new now exists
- `400 Bad Request` — the request was malformed (validation failed)
- `401 Unauthorized` — you are not logged in
- `403 Forbidden` — you are logged in but not allowed
- `404 Not Found` — no such resource
- `500 Internal Server Error` — the server broke; not the client's fault

> Frontend analogy: REST is like a well-designed component API. Every
> endpoint has a clear name, a clear input, and a clear output — and
> errors are typed and meaningful, the HTTP equivalent of good prop
> validation.

### Controller, service, repository (NestJS layering)

NestJS splits each backend feature into three layers with one-way
dependencies. This is the single most important backend pattern to
internalize, because it appears (with different names) in every backend
framework on earth:

```
HTTP request ──▶ Controller ──▶ Service ──▶ Repository ──▶ Database
                    │              │
                    └── validation └── business rules
                        and HTTP      ("the logic")
```

- **Controller** — the only layer that knows about HTTP. It declares the
  routes (`@Get('health')` means "handle `GET /api/health`"), validates
  incoming data against the shared zod contracts, and delegates to the
  service. A controller must be *thin*: no business logic, no database
  access. Its whole job is translating HTTP into plain function calls and
  translating return values back into HTTP responses.
- **Service** — pure business logic. It has no idea HTTP exists: no
  request objects, no status codes. It receives plain typed values,
  applies the rules, and returns plain typed values. In this project the
  service is also where a solve gets orchestrated.
- **Repository** — the only layer that knows about the database. It
  contains the actual queries (via Prisma — see below). Services call
  repositories with plain values; repositories return plain values.

Why the strict separation? Testability and changeability. You can unit-test
a service by handing it a *fake* repository — no database needed. You can
swap the database for a different one by rewriting repositories only.
And the HTTP layer stays so thin that changing the frontend's needs never
touches business logic.

> Frontend analogy: this is your `ui/` vs `features/` vs `lib/` split, but
> enforced by the framework. Your `ui/Button` doesn't fetch data; your
> `features/` hooks don't know about pixels. Same idea, backend-style.

### Dependency injection

NestJS classes *declare* what they need instead of creating it. Look at
the health controller:

```ts
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}
  //        ^ "I need a HealthService. Give me one."
}
```

Nobody writes `new HealthService()`. The NestJS runtime — the **IoC
container** (Inversion of Control: the framework calls *you*, not the
other way around) — sees the constructor signature, constructs a
`HealthService`, and injects it. This is **dependency injection**.

Why bother? Two reasons. First, **swappability**: in tests you can inject
a fake service with canned responses — the controller never knows the
difference. Second, **lifecycle**: the container creates each service
once (a *singleton*) and shares it, so database connections and other
expensive resources aren't created per request.

### Prisma ORM

**ORM** = Object-Relational Mapper. A relational database stores data in
tables with rows and columns (like a spreadsheet per entity: one table for
employees, one for shifts). Your code works with objects. An ORM bridges
the gap: you describe tables in a schema file, and it generates
type-checked query functions — no raw SQL strings in application code.

Prisma (one of the two dominant Node ORMs; the other is Drizzle) generates
a TypeScript client from your schema, so `db.employee.findMany()` is fully
typed — and if you later change the schema, code that breaks shows up as
*type errors*, not runtime database errors.

### DTO and validation

A **DTO** (Data Transfer Object) is the shape of data crossing a boundary
— what the client sends to `POST /api/shifts`, and what it gets back.
"Object" here just means "structured data"; it has nothing to do with
classes.

DTOs must be validated at the boundary. Never trust input: anything coming
over HTTP could be missing fields, wrong types, or malicious. This project
validates with zod schemas shared from `packages/contracts` — the same
schema the frontend uses to build its forms, so the two sides agree *by
construction*.

### Shared contracts (contract-first workflow)

`packages/contracts` holds one zod schema per API shape. Both `web` and
`api` import them. The workflow rule: **any change to an API shape starts
in `packages/contracts`, then ripples outward.**

This is called a **contract-first** workflow, and it has a powerful
consequence: if you add a required field to a contract, the api's
controller and the web app's query *both fail typechecking* until both are
updated. The compiler finds every place that needs changing. In a
polyrepo or with duplicated types, you would instead discover the breakage
at runtime — in production.

## 4. The request lifecycle

The single best way to understand the architecture is to follow one
request from click to response. Let's trace what actually happens when you
open the dashboard.

### Step 1: The browser loads the app

`GET /` hits the **Vite dev server** (port 5173 in dev; a static file
server in production). Vite returns `index.html`, which loads the compiled
React bundle. From here on, the browser is a SPA: navigation happens in
JavaScript, no full page reloads.

### Step 2: The React app asks for health

The `useHealth()` hook runs on mount. It calls:

```ts
const response = await fetch('/api/health');
```

Notice the URL: no host, no port. The browser resolves it against the
page's own origin (`localhost:5173`) — and Vite's dev server has a
**proxy** rule (see `vite.config.ts`):

```ts
proxy: {
  '/api': { target: 'http://localhost:3000', changeOrigin: true }
}
```

A proxy is a middleman that forwards requests. "Any request starting with
`/api` goes to port 3000" — the NestJS api. The browser only ever talks to
one origin, so the browser's **same-origin policy** (the security rule
that blocks requests across origins without special CORS headers) never
gets in the way.

> Frontend analogy: the Vite proxy is exactly what your production reverse
> proxy (nginx etc.) will do later — route `/api` to the backend, serve
> everything else as static files. Same pattern, two environments.

### Step 3: The API handles the request

The request arrives at NestJS on port 3000, path `/api/health`.

- `main.ts` called `app.setGlobalPrefix('api')` at startup, so every route
  lives under `/api`.
- NestJS's router matches `GET /api/health` to the `@Get()` in
  `HealthController`.
- The controller calls `healthService.getHealth()`.
- The service computes the response from its data: status, uptime, and a
  timestamp.
- The controller validates the response against the shared
  `healthResponseSchema` (paranoia is healthy: the service could return
  the wrong shape, and this would catch it in development instead of in
  the browser).
- NestJS serializes it to JSON and sends it back with `200 OK`.

### Step 4: The React app validates and renders

`useHealth` receives the JSON, **validates it again** against the same
schema (defense in depth — both sides check), and TanStack Query caches
the result with the key `['api', 'health']`. The component re-renders with
the data, showing "Status: ok".

Why the same schema on both sides? Because neither side fully trusts the
other — and because "the types say so" is not a runtime guarantee. The
frontend's parse is a runtime check; the backend's is too. If they ever
disagree, the bug is caught by whichever side parses first.

## 5. The solve pipeline (how a schedule actually gets made)

A solve is the interesting flow, and it exists because of one hard rule:
**an HTTP request must never wait on seconds of computation.** Browsers
and load balancers time out; users close tabs; the server's event loop
should serve other requests meanwhile. So solves are asynchronous.

1. The web app submits a scheduling problem (shifts, employees, rules) to
   `POST /api/solves`. The request body is validated against a shared zod
   contract before anything else happens.
2. The api stores the request, then returns immediately with a **job id**
   — a UUID (universally unique identifier) naming this particular solve.
   Think of it as a restaurant order number.
3. The api forwards the problem to the optimizer over HTTP.
4. The optimizer builds a **mixed-integer program** and solves it (see
   below).
5. Clients **poll**: the web app asks "what's the status of job X?" every
   few seconds until the status is terminal (`optimal`, `feasible`,
   `infeasible`, or `failed`).
6. The web app renders the schedule in a calendar UI.

**Queueing vs doing it right now:** for this project, the api hands work to
the optimizer immediately. Production systems often add a **job queue**
(like BullMQ) in the middle — a list of pending jobs with worker
processes that claim them — so that a burst of solves waits politely
instead of overwhelming the solver. That is a later step, and when it
arrives, it changes only the api: the contracts stay the same.

## 6. What happens inside the optimizer

This is step 4 from above, zoomed in — the heart of the project.

### Mixed-integer programming, in plain language

An **optimization problem** has three parts:

1. **Variables** — the things we get to decide. Example: "x = hours the
   café is open" — or, for scheduling, "does employee E cover shift S?",
   a yes/no question.
2. **Constraints** — the rules we must obey. "At least 3 staff on Saturday
   morning." "Nobody works over 40 hours." "Only someone with the Barista
   skill covers the espresso shift."
3. **Objective** — the thing we want to be best: minimize cost, minimize
   overtime, maximize fairness. One number, computed from the variables.

A **solver** is a program that finds values for the variables that satisfy
every constraint and make the objective as good as possible. This is a
solved, well-researched class of problem: solvers like HiGHS (or
Gurobi/CPLEX, the commercial giants) do it thousands of times faster than
any hand-written algorithm.

The "mixed-integer" part: scheduling variables are binary — "employee E
covers shift S" is 1 or 0, no half-covering. Variables that can only be
whole numbers are **integer variables**; continuous ones (like "hours
open") mixed with integer ones make the problem *mixed*-integer. Integer
variables make problems dramatically harder to solve (they force the
solver to explore combinations), but HiGHS is built exactly for this.

> Frontend analogy: constraints are your form's validation rules; the
> objective is your design goal ("fewest clicks"); the solver is a
> compiler that finds any assignment of the inputs that passes validation
> and optimizes the goal. You declare *what* you want, not *how* to find
> it — that's the whole trick of mathematical optimization, versus
> writing an algorithm by hand.

### The three outcomes, and why they matter

Every solve ends in exactly one of three states, and the result type in
`apps/optimizer/src/types.ts` encodes them:

- **optimal** — the best schedule was found *and proven best*. Proven is
  the key word: the solver doesn't just stumble on a good schedule; it
  mathematically certifies that nothing better exists.
- **feasible** — a valid schedule exists, but the solver hit a time limit
  before it could prove optimality. The schedule is usable; it might just
  not be the cheapest possible one.
- **infeasible** — *no* schedule satisfies every rule. The rules
  contradict each other. This is a user-facing event, not a crash: the
  result must carry a **human-readable explanation of which constraints
  conflict** ("Saturday 9am requires a Barista, but every Barista is off
  that morning") so the manager can fix their input.

This honesty about infeasibility is what separates real optimization
products from demos. Real-world inputs are often over-constrained, and a
good product explains why rather than spinning forever.

### HiGHS.js

HiGHS is a production-grade MIP/LP solver written in C++ (it powers parts
of Google's OR-Tools). **HiGHS.js** compiles it to **WebAssembly** (WASM)
— a way to run native-speed C++ inside Node or a browser. The package has
a quirk worth knowing: it takes problems as text in a plain format (the
"LP format", a human-readable way to write a model) rather than a
JavaScript API, so our model code builds the text representation and hands
it to the solver.

All modeling lives in the optimizer as **pure functions**: typed inputs in,
typed results out, no I/O, no database access inside the solver. This is
the rule that keeps the math testable: you can call the model with small
hand-computed cases and assert the exact expected answer (we already do
this in `solver.test.ts`).

## 7. Time handling (domain rule)

All time is stored and computed as **minutes since Monday 00:00** of the
schedule week. Display formatting ("Mon 9:00") happens only in the
frontend. One shared time utility exists; ad-hoc date math is forbidden.

Why? Time zones and daylight savings make calendar math famously buggy.
By reducing everything to one flat integer (minutes since week start),
the solver's constraints become simple arithmetic (`end - start = hours`
is exact), and all the messy human formatting stays in the one layer that
exists to present things.

## 8. Data flow rules (the contract)

- **web → api**: REST/JSON, validated against `packages/contracts` zod
  schemas on *both* sides.
- **api → optimizer**: HTTP, via a typed client module.
- **api → PostgreSQL**: via Prisma repositories. Services never contain
  raw SQL.
- **Never**: web → optimizer directly; `process.env` scattered through
  the code (one typed `ConfigModule` owns all configuration).

## 9. Where to look next

1. `apps/api/src/skills/` — the smallest full feature: repository (storage
   contract + in-memory double used by unit tests), service (business
   rules), controller (thin HTTP), module (wiring). Read in that order.
2. `apps/api/src/employees/` and `apps/api/src/shifts/` — the same pattern
   with a cross-resource rule: they check referenced skills exist.
3. `apps/api/src/prisma/` — the PostgreSQL side of the storage contract:
   `prisma.service.ts` (the shared client), the `prisma-*.repository.ts`
   implementations behind the same tokens, and `mappers.ts` (database rows
   → contract shapes). `skills/skill.repository.ts` shows how the modules
   swap implementations with one `useClass` line.
4. `apps/api/src/config/env.schema.ts` — the single place environment
   variables are declared and validated (zod), feeding `ConfigService`.
5. `apps/api/src/common/filters/http-exception.filter.ts` — how every error
   becomes the contracted `{ statusCode, message, details }` envelope.
6. `packages/contracts/src/index.ts` — the single source of truth for API
   shapes, with a comment per schema.
7. `apps/optimizer/src/schedule-model.ts` and `solve-schedule.ts` — the
   scheduling model itself: pure model builder (variables, constraints,
   fairness linearization, LP text) and the orchestrator that runs HiGHS
   and maps results. `docs/OPTIMIZATION.md` walks through it line by line.
   `http-server.ts` is its thin HTTP face; `apps/api/src/solves/` is the
   api side — the job lifecycle (`solves.service.ts`), the typed
   `OptimizerClient` boundary, and `docs/adr/README.md` ADR-005 for why
   jobs run in-process.
8. `apps/web/src/features/schedule/` — the web layer consuming all of it:
   contract-validated forms, the Zustand store for the one piece of pure UI
   state, and the polling hook that renders the solver's week.
   `docs/FRONTEND.md` explains the state split; `docs/MONOREPO_BASICS.md`
   covers repo mechanics and `docs/DATABASE.md` the database handbook.

## What I learned — Milestone 1 (backend CRUD)

- **Contract-first pays immediately.** Every API shape is a zod schema in
  `packages/contracts`; the api validates request bodies against them and
  parses its own responses with them. When the create schema was missing
  the "end after start" rule that the response schema had, the runtime
  caught it during smoke testing — proving both sides of the contract
  matter, not just the response shape.
- **Layering catches bugs by construction.** Controllers validate and
  delegate; services enforce business rules; repositories store. Because
  the layers are separate, the referential-integrity check (an employee's
  skills must exist) lives in one place, and both employee and shift
  services share it via the skill repository.
- **DI tokens vs interfaces.** TypeScript erases interfaces at compile
  time, so NestJS cannot use `EmployeeRepository` as an injection key.
  The fix is a `Symbol('EmployeeRepository')` token. This is a subtle,
  real-world NestJS detail that unit tests don't surface until you wire
  modules.
- **Module exports are opt-in.** NestJS shares nothing across modules by
  default. `SkillsModule` had to export `SKILL_REPOSITORY` before
  `EmployeesService` could inject it — a runtime failure the unit tests
  missed, and the reason a module-wiring test now exists.
- **Partial updates need merged validation.** A `PATCH` is validated
  field-by-field, but the *merged* result can still be invalid (moving
  startMinute past endMinute). The service re-validates the merged entity
  against the full contract before storing.

## What I learned — Milestone 2 (database)

(The full narrative lives in `docs/DATABASE.md`; these are the highlights.)

- **The layering earned its keep.** Swapping in-memory `Map` storage for
  PostgreSQL changed exactly one provider line per module
  (`useClass: InMemory...Repository` → `useClass: Prisma...Repository`)
  plus the new files under `src/prisma/`. Controllers, services, and the
  HTTP contract did not change at all.
- **The database enforces rules code cannot forget.** Referential
  integrity (every `skillId` must exist) was a hand-written service check;
  now foreign keys guarantee it for every code path forever. The same swap
  surfaced a latent bug: deleting a referenced skill used to silently leave
  dangling references — the database refuses, and that became a proper 409.
- **Env vars are validated once, at boot.** The zod schema in
  `config/env.schema.ts` is the only place env is interpreted; a missing
  `DATABASE_URL` now fails startup with a readable message instead of a
  cryptic Prisma error later.

## What I learned — Milestone 3 (optimization core)

(The full narrative lives in `docs/OPTIMIZATION.md`; these are the highlights.)

- **The objective you expect may be mathematically inert.** With exact
  headcount coverage, "minimize assigned minutes" is a constant — the
  fairness variable is what actually chooses between schedules. The model
  documents this honestly instead of pretending the cost term decides.
- **Fairness had to be linearized.** "Balanced weekend load" became
  "minimize the maximum weekend count" via one auxiliary variable and one
  row per employee — the standard, fully-linear trick.
- **Pruning beats constraining.** Illegal employee–shift pairs never
  become variables; the rules are enforced by construction and the LP
  stays small.
- **Solver quirks live in exactly one file.** `highs-solver.ts` is the
  only code that knows HiGHS's string API, seconds-not-milliseconds time
  limits, and status strings — and unknown statuses throw rather than
  masquerade as schedules.

## Authentication (Milestone 6)

The API uses **JWT (JSON Web Tokens)** for authentication. This is the
most common auth pattern in REST APIs — here's how it works:

### The flow

```
1. Register/Login ──▶ API returns a JWT token
2. Client stores the token (in memory or localStorage)
3. Every write request includes: Authorization: Bearer <token>
4. API verifies the token's signature with a secret key
5. If valid: request proceeds. If not: 401 Unauthorized.
```

### Why JWT?

- **Stateless**: the server doesn't need to store sessions. The token
  itself contains the user's identity (signed with a secret). This means
  no session store (Redis, database) to manage.
- **Standard**: JWT is the industry standard for REST API auth. Every
  language and framework has JWT libraries.
- **Portable**: the same token works from the web app, a mobile app, or
  a CLI tool.

### The global guard

Every route is protected by default. The `JwtAuthGuard` is registered as
a global guard via NestJS's `APP_GUARD` token. Routes that should be
public (health checks, read endpoints, auth endpoints) are marked with
the `@Public()` decorator.

This is "secure by default" — forgetting `@Public()` on a read endpoint
is a minor inconvenience; forgetting auth on a write endpoint is a
security hole.

### Password hashing

Passwords are hashed with **bcrypt** (10 salt rounds). bcrypt is a
one-way function: you can check if a password matches the hash, but you
can't reverse the hash to get the password back. This means even if the
database is compromised, attackers can't read the passwords.

## Containers (Milestone 6)

The entire stack runs in Docker containers, defined in `docker-compose.yml`:

```
┌─────────────────────────────────────────────────────────────┐
│  docker compose                                             │
│                                                             │
│  ┌─────────┐   ┌─────────┐   ┌───────────┐   ┌─────────┐  │
│  │ web     │   │ api     │   │ optimizer │   │ db      │  │
│  │ nginx   │──▶│ NestJS  │──▶│ HiGHS.js  │   │ Postgres│  │
│  │ :80     │   │ :3000   │   │ :3002     │   │ :5432   │  │
│  └─────────┘   └────┬────┘   └───────────┘   └─────────┘  │
│                     │                                      │
│                     └──────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Why containers?

- **Reproducibility**: "works on my machine" becomes "works on every
  machine". The container includes the exact Node.js version, the exact
  dependencies, and the exact configuration.
- **Isolation**: each service runs in its own container with its own
  filesystem. The API can't accidentally read the optimizer's files.
- **One command**: `docker compose up --build` starts everything —
  database, API, optimizer, web server — with one command.

### Multi-stage builds

Each Dockerfile uses **multi-stage builds**:
1. **Build stage**: install all dependencies, compile TypeScript
2. **Production stage**: copy only the compiled output and production
   dependencies

This keeps the production images small (no TypeScript compiler, no dev
dependencies) while the build stage has everything it needs.

## What I learned — Milestone 4 (orchestration)

(The full narrative lives in `docs/MILESTONE-REPORTS.md` and ADR-005.)

- **The async job pattern is mostly an error-handling discipline.** The
  happy path is three lines; the real work is guaranteeing that every
  failure — client crash, timeout, database down — lands somewhere
  visible (`failed` + message) instead of stranding a job in `running`
  or crashing the process with an unhandled rejection.
- **Typed boundaries beat stringly ones in both directions.** The api's
  `HttpOptimizerClient` parses the optimizer's response against the shared
  contract, so a misbehaving model server can never smuggle a wrong shape
  into the job row — the same discipline the api applies to its own
  clients.
- **Parallel test files vs one shared database.** Adding a second
  integration suite exposed that Jest runs test files in parallel workers;
  one shared test database means files must not interleave — `maxWorkers:
  1` and a documented reason.

## What I learned — Milestone 5 (frontend integration)

(The full narrative lives in `docs/FRONTEND.md` and
`docs/MILESTONE-REPORTS.md`.)

- **State belongs where its owner is.** Server data lives in TanStack
  Query (cached, invalidated, polled); the one piece of pure UI state —
  which job the page is watching — lives in Zustand with sessionStorage;
  form rules live in the shared zod contracts. The bugs were all
  boundary bugs, and every boundary had a tool.
- **The contract rule enforced itself twice.** The time utility threw on a
  weekly cap passed to the clock-time formatter (2400 minutes is not
  "40:00"), and the create schemas re-validated form output before it
  left the page — the shared contracts caught the UI's own mistakes.
- **Ambient environment is part of the test contract.** React 19.2 removed
  `act` from its production build; a machine with `NODE_ENV=production`
  silently broke every component test. Vitest now pins the environment.

## What I learned

- Architecture is about *boundaries*: three services, each owning one job,
  talking over HTTP, so no part can drag down the others.
- REST is resources plus HTTP methods plus status codes; NestJS layers
  controllers (HTTP), services (logic), and repositories (database) with
  one-way dependencies.
- Dependency injection means classes declare needs instead of constructing
  them, making everything testable and shareable.
- Solves must be asynchronous because HTTP must never block: return a job
  id, poll for the result.
- An optimization model is variables + constraints + objective; the solver
  has exactly three honest outcomes, and infeasibility is a first-class
  result that must be explained to the user.
