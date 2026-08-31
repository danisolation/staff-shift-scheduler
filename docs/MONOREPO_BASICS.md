# Monorepo Basics

A guided tour of this repository's setup, written for a reader with frontend
experience and no prior exposure to monorepos, package managers, or CI.

Reading time is whatever you make of it — each section stands alone, so you
can read top to bottom or jump around. Every concept is defined the first
time it appears.

---

## Part 1: What a monorepo is, and why anyone bothers

A **repository** (repo) is a folder under git version control — a project
with a history. The "mono" prefix means *one*. So a **monorepo** is one repo
that contains many separate projects.

Imagine building the scheduler the "traditional" way. You would create four
separate git repos:

- `shift-scheduler-web` (the React app)
- `shift-scheduler-api` (the NestJS backend)
- `shift-scheduler-optimizer` (the math engine)
- `shift-scheduler-contracts` (the shared zod schemas)

This setup — called a **polyrepo** (many repos) — works. Millions of teams
use it. But it has real costs:

1. **Four repos = four sets of everything.** Four CI pipelines, four
   dependency setups, four sets of docs, four places to open PRs.
2. **Cross-project changes are painful.** Say the API response for a shift
   gains a new field. You must update `contracts` first, publish it, then
   bump the version in `web` and `api`, then release those. One logical
   change now spans three repos and three releases.
3. **Nothing is atomic.** An atomic change is one that either fully happens
   or doesn't happen at all. In a polyrepo, the `contracts` change might
   merge while the `web` change is still in review — for a window of time,
   the pieces don't fit together.

A monorepo solves all three at once:

- One repo, one CI pipeline, one `pnpm install`, one set of commands.
- A change that touches `contracts` + `web` + `api` is a **single commit**,
  a single PR, reviewed as one unit.
- Everything is always in sync, because everything is always the same
  version.

The trade-off: monorepos need tooling to stay fast. That tooling is
**pnpm workspaces** (how packages find each other) and **Turborepo** (how
tasks run without repeating work). Both are explained below.

> Frontend analogy: a monorepo is like your `src/` folder containing
> `features/`, `ui/`, and `lib/` — but one level up, where each "feature"
> is a deployable application with its own `package.json`.

---

## Part 2: pnpm workspaces — how packages find each other

### Step 1: What a package manager does

When you write `import { z } from 'zod'`, something must figure out what
`zod` means. A **package manager** resolves that name to a real folder of
code on disk (`node_modules/zod`), making sure the right version is there.
The big three are npm, yarn, and pnpm.

We use **pnpm** because:

- It is fast (it caches every package once on your machine and links it,
  instead of copying it into every project).
- It is strict (your code can only import what your `package.json` declares
  — a classic bug source, "I imported X but forgot to add it", becomes an
  error instead of a mystery).
- It is the current industry default for new TypeScript monorepos.

### Step 2: What a workspace is

Look at the root [`pnpm-workspace.yaml`](../pnpm-workspace.yaml):

```yaml
packages:
  - "apps/*"
  - "packages/*"

allowBuilds:
  esbuild: true
```

The `packages:` list tells pnpm: "every folder directly inside `apps/` and
`packages/` is its own project (a **workspace package**), each with its own
`package.json`." That is the entire trick. Five folders match:

- `apps/web`, `apps/api`, `apps/optimizer`
- `packages/contracts`, `packages/config`

So one `pnpm install` at the root installs dependencies for all five at
once. You never install inside the subfolders.

### Step 3: How packages depend on each other

Open [`packages/contracts/package.json`](../packages/contracts/package.json)
and notice the `name`:

```json
"name": "@scheduler/contracts"
```

That name *is* the import name. Because `contracts` is a workspace package,
other packages can declare it as a dependency and import it exactly like a
published npm package:

```json
// apps/web/package.json
"dependencies": {
  "@scheduler/contracts": "workspace:*"
}
```

```ts
// apps/web/src/features/dashboard/use-health.ts
import { healthResponseSchema } from '@scheduler/contracts';
```

Two details worth knowing:

- `workspace:*` means "use the version in this monorepo, whatever it is."
  You never bump versions by hand while everything lives in one repo.
- The `@scheduler/` prefix is a **scope** — a namespace, like an npm
  organization. It keeps our packages from colliding with public ones
  (there is no public package named `web`; if we named ours just `web`,
  imports would be ambiguous).

### Step 4: How the same package looks different to different consumers

Here is a subtle problem, and it bit us during setup, so it is worth
understanding properly.

`apps/api` (NestJS) is compiled to **CommonJS** modules — the old Node
standard, using `require()`. `apps/web` (Vite) uses **ESM** — the modern
standard, using `import`. `contracts` must work for both.

Look at the `exports` block in `packages/contracts/package.json`:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./src/index.ts",
    "require": "./dist/index.js"
  }
}
```

This is a **conditional export map**: depending on *how* a consumer asks
for the package, it receives a different file:

- A tool using `import` (Vite, webpack) gets `src/index.ts` — the original
  TypeScript source, which Vite compiles itself.
- A tool using `require` (NestJS at runtime) gets `dist/index.js` — the
  compiled JavaScript output of `tsc`.
- TypeScript itself always gets `dist/index.d.ts` — the generated type
  declarations.

Without this, Vite would try to read CommonJS output (breaking) or NestJS
would try to run raw TypeScript (breaking). The map routes each consumer to
the format it understands. This pattern is called **dual publishing** and
is standard practice for shared packages.

> Frontend analogy: conditional exports are like `responsive-design`-style
> content negotiation — the same URL serves different content to different
> clients. A mobile browser gets the mobile bundle; a `require`-ing Node
> process gets CommonJS.

---

## Part 3: Turborepo — how tasks run without repeating work

### The problem it solves

The monorepo has five packages. `pnpm lint` in a monorepo could mean "run
lint in all five." But naive orchestration has two problems:

1. **Order.** `contracts` must be *built* before `web` typechecks against
   it. Something must know the dependency graph.
2. **Redundancy.** If you changed only `apps/web`, rebuilding `contracts`
   and `api` is wasted time. Something must know what changed.

That something is **Turborepo**. You talk to it through the scripts in the
root `package.json`:

```json
"scripts": {
  "dev": "turbo run dev",
  "build": "turbo run build",
  "lint": "turbo run lint",
  "typecheck": "turbo run typecheck",
  "test": "turbo run test"
}
```

So `pnpm build` at the root really runs `turbo run build` — "run the
`build` script in every package that has one, in dependency order, with
caching."

The behavior is configured in [`turbo.json`](../turbo.json):

```json
"tasks": {
  "build": {
    "dependsOn": ["^build"],
    "outputs": ["dist/**"]
  },
  "dev": {
    "cache": false,
    "persistent": true
  },
  "lint": {},
  "typecheck": {
    "dependsOn": ["^build"]
  },
  "test": {
    "dependsOn": ["^build"]
  }
}
```

Reading it line by line:

- `"dependsOn": ["^build"]` — the `^` means "in packages this one depends
  on." So building `web` first builds `contracts` (its dependency). Same
  for `typecheck` and `test`: they first build dependencies, because
  typechecking `web` needs `contracts`' compiled output to exist.
- `"outputs": ["dist/**"]` — after a successful build, Turbo remembers a
  hash of the inputs and the produced `dist/` folder. Next time, if the
  inputs (source files, config) are unchanged, Turbo **replays the cached
  output instantly** and skips the work entirely. You saw this in action:
  the final verification printed `FULL TURBO` — everything came from cache.
- `"cache": false, "persistent": true` for `dev` — dev servers run forever
  (persistent), and you never want a "cached" dev server (a cached long-
  running process would be nonsense), so caching is off for `dev`.

> Frontend analogy: Turborepo is like Vite's build cache or your browser's
> HTTP cache, applied to entire projects. Change nothing → rebuild nothing.

---

## Part 4: The shared config package

[`packages/config`](../packages/config/package.json) exists so all five
packages share one set of TypeScript and ESLint rules instead of five
slightly-different copies. It is a workspace package like any other, so
packages import its configs by name.

### TypeScript

[`packages/config/tsconfig.base.json`](../packages/config/tsconfig.base.json)
holds the rules every package inherits:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

Each package's own `tsconfig.json` extends it and adds what it needs:

```json
// apps/web/tsconfig.json
{
  "extends": "@scheduler/config/tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**`extends`** is standard TypeScript config inheritance: child settings
override parent settings; everything else is inherited. This means the
`strict: true` rule (the one that turns off `any` by default and makes
TypeScript actually catch null bugs) is defined once and enforced
everywhere.

> Frontend analogy: `tsconfig.base.json` is like a `theme` in your styling
> setup — the design tokens, defined once; each package overrides only its
> own details.

### ESLint

ESLint 9 uses **flat config** — one `eslint.config.js` (or `.mjs`) per
package, exporting an array of config objects. `packages/config` exports
two ready-made arrays:

- `eslint-base.js` — recommended rules for plain TypeScript, plus
  `eslint-config-prettier`, which turns off all ESLint rules that would
  fight Prettier's formatting. (Prettier formats, ESLint checks logic —
  they should never argue about the same thing.)
- `eslint-react.js` — the base config plus the React hooks rules (the ones
  that catch "used a hook inside an if statement" bugs) and the
  vite-refresh rules.

Each package then just spreads the right one:

```js
// apps/web/eslint.config.js
import react from '@scheduler/config/eslint-react';
export default [...react];
```

One rule change in `packages/config` now applies everywhere — that is the
whole point of centralizing config.

---

## Part 5: The rest of the root, file by file

Everything at the repo root, explained:

| File | What it is | Why it exists |
|------|------------|---------------|
| `package.json` | The **root package**. Not an app — a container for workspace-wide scripts (`dev`, `build`, `lint`, `typecheck`, `test`), plus the few tools used at the root (`turbo`, `prettier`). The `private: true` flag prevents accidentally publishing the whole monorepo to npm. | One place to run everything. |
| `pnpm-workspace.yaml` | Declares which folders are workspace packages (see Part 2). | Tells pnpm where the projects live. |
| `pnpm-lock.yaml` | **Lockfile**: records the exact resolved version of every dependency, recursively. Generated automatically by `pnpm install`. | Guarantees that you, your teammates, and CI all install *identical* versions. Never edit by hand. |
| `turbo.json` | Turborepo task configuration (see Part 3). | Defines build order and caching. |
| `tsconfig.base.json` | Root TypeScript defaults (the shared config package's base is a copy for packages that need standalone builds). | One source of TS truth. |
| `.gitignore` | Tells git which files to never track: `node_modules/` (dependencies — always reinstalled), `dist/` (build output — always rebuildable), `.env` (secrets), etc. | Keeps the repo clean; secrets must never be committed. |
| `.prettierrc.json` | Prettier formatting rules (single quotes, 100-char width, trailing commas). | One consistent format, enforced on save and in CI. |
| `AGENTS.md` | The rulebook for AI agents working in this repo. | Every agent (and you) follows the same standards. |
| `README.md` | The human-facing entry point. | First thing a visitor reads. |
| `.github/workflows/ci.yml` | The CI pipeline (see Part 6). | Automated quality gates on every PR. |
| `docs/` | Long-form documentation. | Deep explanations live here, not in code. |

---

## Part 6: CI — what runs on every PR

Open [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). This is a
**GitHub Actions workflow**: a YAML file that describes what should happen
when something occurs in the repo. It declares one job, `quality`, which
runs on `ubuntu-latest` (a fresh Linux machine GitHub provides) on every
push to `main` and every pull request.

The steps, translated into plain language:

1. **Checkout** — download the repo's code onto the fresh machine.
2. **Setup pnpm** and **Setup Node 22** — install the toolchain; `cache: pnpm` tells GitHub to restore pnpm's cache so installs are fast.
3. **Install dependencies** — `pnpm install --frozen-lockfile`. The
   `--frozen-lockfile` flag means "install *exactly* what the lockfile
   says, and fail if anything would change it." This is what guarantees
   reproducibility: CI refuses to run with undeclared versions.
4. **Lint, Typecheck, Test, Build** — the same four commands you run
   locally.

The philosophy: **CI runs the same commands you run locally**, so a green
CI is just proof that your local run was green too. CI is not a linter —
it is a reminder that you should have run the linter before pushing.

> Frontend analogy: CI is your "preview deploy" but for code health
> instead of pixels — a neutral, reproducible check that the PR doesn't
> break anything.

---

## Part 7: The daily workflow

The commands you will actually use, in order:

```bash
pnpm install      # after pulling changes that touched dependencies
pnpm dev          # run web + api + optimizer together in watch mode
pnpm lint         # before committing
pnpm typecheck    # before committing
pnpm test         # before committing
pnpm build        # the final sanity check
pnpm format       # let Prettier fix formatting
```

Everything at once:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

That one line is what CI runs. Make it green locally and the PR will be
green too.

---

## What I learned

- A monorepo trades extra tooling for atomic cross-package changes, one
  CI pipeline, and one source of truth.
- pnpm workspaces turn folders into importable packages; the package's
  `name` becomes its import name; `workspace:*` pins dependencies to the
  local version.
- Conditional exports (`import` vs `require`) let one package serve ESM
  and CommonJS consumers from the same source of truth.
- Turborepo runs tasks in dependency order and caches outputs, so
  unchanged packages rebuild instantly.
- Shared configs centralize TypeScript/ESLint rules so all packages stay
  consistent by construction.
- CI is not magic: it runs the same four commands locally runnable
  commands on a clean machine, with a frozen lockfile for reproducibility.

**Next learning step:** read `apps/api/src/` — the NestJS module structure
(controllers, services, dependency injection) is the next concept on the
path.
