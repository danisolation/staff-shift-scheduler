# AGENTS.md

This file is the authoritative rulebook for every AI agent working in this repository. Read it in full before making any change. Where it conflicts with generic coding habits, this file wins.

## 1. Project Overview

**Staff Shift Scheduler** — a web application that solves the shift-scheduling problem. Managers define shifts, employees, availability, skills, and labor rules; the backend runs a mixed-integer optimization that assigns employees to shifts; results are visualized in a calendar-style UI.

Constraints modeled: shift coverage requirements, employee availability, skills/qualifications, max hours and break rules, fairness objectives (e.g. balanced weekend load). The solver produces a schedule that is feasible (or reports infeasibility with a clear explanation).

**Language policy: TypeScript everywhere.** No Python, no second language. The project owner does not write Python; everything from UI to solver is TypeScript.

**Learning context:** The project owner is a professional front-end developer using this project to learn backend engineering, databases, DevOps, and mathematical optimization from scratch. Agents are teachers first: explain concepts in plain language and keep the owner oriented at every step. The engineering bar (production-grade, portfolio quality) is the destination, not the starting point — code may be simpler than the most advanced pattern as long as it is correct, clean, and explained.

## 2. Approved Tech Stack

Use only these technologies. Do NOT introduce alternatives without explicit approval; if a task seems to need a new dependency, flag it instead of adding it.

| Layer | Technology |
|-------|------------|
| Frontend framework | React 19 + TypeScript (strict) |
| Build tool | Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix) |
| Client state | Zustand |
| Server state | TanStack Query v5 |
| Forms | react-hook-form + zod |
| Routing | React Router 7 |
| Backend | NestJS 11 (Node 22) |
| Optimization engine | TypeScript (Node 22) service |
| Optimization solver | HiGHS.js (WASM build of HiGHS, a production-grade MIP/LP solver) |
| Database | PostgreSQL + Prisma ORM |
| API contracts | zod (shared via packages/contracts) |
| Package manager | pnpm workspaces |
| Monorepo tooling | Turborepo |
| Testing (web) | Vitest + React Testing Library |
| Testing (api) | Jest (NestJS default) |
| E2E | Playwright |
| Linting/formatting | ESLint (flat config) + Prettier |
| Git hooks | husky + lint-staged + commitlint |
| CI/CD | GitHub Actions (lint, typecheck, test, build on every PR) |
| Containers | Docker + docker-compose |

## 3. Architecture

```
┌────────────┐   REST/JSON   ┌────────────┐   HTTP   ┌──────────────────┐
│  apps/web  │ ─────────────▶│  apps/api  │ ───────▶ │ apps/optimizer   │
│  React SPA │               │  NestJS    │          │ Node + HiGHS.js  │
└────────────┘               └─────┬──────┘          └──────────────────┘
                                   │
                                   ▼
                           PostgreSQL (Prisma)
```

- `apps/web` — React SPA. Never does math beyond trivial UI logic.
- `apps/api` — NestJS REST API. Auth, persistence, orchestration, job management. Calls the optimizer over HTTP.
- `apps/optimizer` — TypeScript Node service. ALL mathematical modeling lives here (variables, constraints, objective, solver calls). This isolation mirrors the industry model-server pattern and keeps a future swap to a dedicated solver backend painless.
- `packages/contracts` — zod schemas shared between web and api. API DTOs are defined once here; both sides import them.

Service boundary rules:
- The web app talks only to `apps/api`, never to the optimizer directly.
- The api talks to the optimizer via a typed client module.
- Any change to an API shape starts in `packages/contracts`, then ripples outward.

**Suggested learning order** (agents sequence work to follow this):
1. Monorepo basics (pnpm workspaces, Turborepo, shared configs)
2. Backend (NestJS modules/controllers/services, REST, validation)
3. Database (PostgreSQL via Docker, Prisma schema + migrations, repositories)
4. Optimization (modeling concepts, HiGHS.js, solver outcomes)
5. Frontend integration (TanStack Query, forms, calendar UI)

## 4. Repository Structure

```
opt/
├── apps/
│   ├── web/           # React + Vite frontend
│   ├── api/           # NestJS backend
│   └── optimizer/     # TypeScript + HiGHS.js optimization engine
├── packages/
│   ├── contracts/     # shared zod schemas + types
│   └── config/        # shared ESLint/TS configs
├── docs/              # ARCHITECTURE.md, ADRs (architecture decision records), ROADMAP.md
├── turbo.json
├── pnpm-workspace.yaml
└── AGENTS.md
```

**Progress tracking:** `docs/ROADMAP.md` is the single source of truth for
project progress. Every agent must read it before starting work and update
it when a milestone's acceptance criteria are genuinely satisfied. Without
it, no agent can know what is done and what is next.

## 5. Git & Workflow

- NEVER run `git commit` or `git push` unless the human explicitly requests it in the current conversation. Agents may stage and use `git status`/`git diff` freely, but committing and pushing always wait for an explicit instruction.
- Trunk-based development with short-lived feature branches: `feat/...`, `fix/...`, `chore/...`, `docs/...`
- NEVER commit directly to `main`. All work lands via PRs.
- Conventional Commits, enforced by commitlint: `feat(web): add dashboard charts`
- One commit = one logical change. Rebase/squash before merging.
- Run lint, typecheck, and tests locally BEFORE pushing. CI runs them anyway; don't let CI be your linter.

## 6. Code Standards

### Learning-First Rules (apply everywhere)

- **Fix the owner's English first.** The project owner is learning English. When the owner's message contains grammar, spelling, or phrasing mistakes, the agent corrects them politely before doing anything else: show the original sentence rewritten correctly (with a short note on what changed), then proceed with the task. Corrections come first — before explanations, before code. Never mock; teaching is the point.
- **Explain before you build.** Before writing backend, database, Docker, or solver code, give a plain-language explanation of the concept and why the industry does it this way. No jargon without defining it. The owner is a frontend developer — assume no backend/devops/optimization knowledge, but fluent frontend knowledge (so frontend analogies are welcome).
- **Explain thoroughly, not briefly.** Prefer longer, fuller explanations over short summaries. Assume the reader will pause and want the "why" at every step. When a concept has layers (e.g. "what is a REST API" leads to "what is a route" leads to "what is a status code"), walk through each layer. If a step involves multiple new concepts, list them up front, then explain each one before using it.
- **Simplest correct approach wins.** Prefer the simplest pattern that solves the problem over the cleverest. Introduce a more advanced pattern only after explaining why the simple one falls short.
- **Educational comments.** In `apps/api` and `apps/optimizer`, brief `// why` comments are welcome where the logic is non-obvious, because the owner is learning these layers. Frontend code stays comment-light, matching real-world practice.
- **One concept per step.** Propose small, focused increments. When a task touches several unfamiliar concepts (e.g. Prisma migrations + NestJS dependency injection + Docker networking), split it into sequenced steps.
- **Every task ends with "What I learned".** Each completed task includes a plain-English summary: which concepts were used, why, and what to learn next. This summary is thorough — not bullet-point shorthand, but short paragraphs explaining each concept as if teaching it for the first time.
- **Learning-friendly docs.** `docs/` is written for a reader with frontend experience and no backend background: define every term on first use, show step-by-step setup, link official documentation, and explain the "why" behind each decision — not just the "what". Prefer a longer doc the reader can skim over a shorter one that leaves questions unanswered.

### General
- TypeScript `strict: true` everywhere. No `any`, no `@ts-ignore` unless a comment proves it unavoidable.
- Prefer composition and small pure functions. Pure logic must be unit-tested.
- No dead code, no commented-out blocks, no leftover console.log.
- Explicit over clever. Readability beats brevity.
- Never swallow errors; surface typed, actionable messages to the user.

### Frontend (apps/web)
- Function components + hooks only. No class components.
- Server state → TanStack Query (caching, retries, invalidation). Client-only UI state → Zustand. Never put server data in Zustand.
- Query keys: feature-based factory functions (e.g. `const userKeys = {...}`), never inline strings.
- Styling: shadcn/ui components + Tailwind utilities. No custom CSS files unless unavoidable; no inline styles.
- Forms: react-hook-form with zodResolver; zod schemas imported from `packages/contracts`.
- Components: `ui/` (pure, presentational), `features/<name>/` (domain logic, own hooks), `lib/` (utilities). One component per file.
- Accessibility: semantic HTML, labels on inputs, visible focus states, keyboard navigability.

### Backend (apps/api)
- NestJS structure: modules → controllers (thin, HTTP only) → services (business logic) → repositories (Prisma).
- Controllers never contain business logic. Services never touch HTTP concerns.
- DTO validation via zod schemas from `packages/contracts`.
- Global exception filter returns a consistent error envelope: `{ statusCode, message, details }`.
- Env vars: single `ConfigModule` with typed config objects; never `process.env` sprinkled around.

### Optimization Engine (apps/optimizer)
- TypeScript strict, same lint rules as the rest of the repo.
- All modeling code is pure functions: typed input objects → typed result objects. No I/O, no DB access inside the solver.
- Every model documents its objective function, constraints, and assumptions in a JSDoc header.
- Solver configuration (time limits, MIP gaps, weights) lives in a typed config object — no magic numbers.
- The solver must distinguish three outcomes in its typed result: `optimal`, `feasible`, `infeasible` — and infeasible results must carry a human-readable explanation of which constraints conflict.
- Numerical tests verify against hand-computed small cases with known optimal solutions.

### Domain Rules (staff scheduling)
- Time is stored and computed in minutes-since-week-start; display formatting happens only in the frontend. Never invent ad-hoc date math — use a single shared time utility.
- Shifts have: start, end, required skill(s), required headcount.
- Employees have: availability windows, skill list, contract max hours per week.
- Fairness objectives (e.g. balanced weekend shifts) are configurable weights, not hard-coded.
- A "solve" is an asynchronous job: the api returns a job id immediately, and clients poll for the result. Long solves never block an HTTP request.

## 7. Testing

- Unit tests for all pure logic (React hooks, NestJS services, solver models).
- Integration tests for API endpoints and Prisma against a test database.
- E2E (Playwright) for the critical user journey only.
- Coverage: aim for >80% on `apps/api` and `apps/optimizer`; meaningful coverage of web logic (snapshot coverage is worthless).
- Never skip failing tests, never merge tests marked TODO.
- Tests must pass in every package before a PR is opened.

## 8. Definition of Done

A task is done only when ALL of these hold:
- Feature works end to end, not just in isolation.
- Typecheck passes in all packages; lint is clean.
- Tests written and passing.
- API contract changes reflected in `packages/contracts`.
- No new dependencies without justification in the PR description.
- PR description includes a plain-English explanation of the concepts used (this is a learning repo).
- Documentation (README/ARCHITECTURE.md) updated if behavior or setup changed.

**Feature sequencing rule:** every feature must be useful and bug-free before
the next one starts. Never churn out new features while existing ones remain
unfinished — no stubs, no half-wired screens, no "we'll finish it later"
endpoints. A feature that is not working end to end blocks all new work
until it is fixed. Finish and stabilize first; expand second.

## 9. Useful Commands

```bash
pnpm dev            # run web + api + optimizer together (Turborepo)
pnpm build          # build all packages
pnpm lint           # lint all packages
pnpm typecheck      # tsc --noEmit across the repo
pnpm test           # run all tests
pnpm --filter web test          # tests in one package
pnpm --filter api start:dev     # run NestJS in watch mode
```

## 10. Dependency Policy

- Adding a package requires a stated reason in the PR description.
- Prefer well-maintained, widely adopted libraries. Check weekly downloads and last-publish date.
- Never add a dependency to do something the standard library / existing stack already does.
