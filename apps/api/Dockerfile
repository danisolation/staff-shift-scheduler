# ---- Build stage ----
FROM node:22-alpine AS build

# pnpm needs corepack (ships with Node 22, just needs enabling).
RUN corepack enable

WORKDIR /app

# Copy the monorepo root manifests + workspace definition first.
# Docker caches this layer — dependencies only reinstall when these change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
COPY apps/optimizer/package.json apps/optimizer/
COPY apps/web/package.json apps/web/

# Prisma's postinstall script (prisma generate) needs the schema file.
# Copy it early so the install layer can find it.
COPY apps/api/prisma apps/api/prisma

# Install everything (the lockfile pins versions).
RUN pnpm install --frozen-lockfile

# Copy source code for the packages the api depends on.
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build contracts first (the api resolves @scheduler/contracts from dist/).
RUN pnpm --filter @scheduler/contracts build

# Build the api (tsc → dist/).
RUN pnpm --filter @scheduler/api build

# ---- Production stage ----
FROM node:22-alpine AS production

RUN corepack enable

WORKDIR /app

# Copy the monorepo manifests again (production needs them for pnpm).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

# Install production dependencies only.
# --ignore-scripts skips the postinstall hooks (prisma generate already ran
# in the build stage; the generated client is copied below).
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy the built output, Prisma schema + migrations, and the generated client.
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json packages/contracts/
COPY --from=build /app/packages/config packages/config

# Copy the pnpm store (contains prisma CLI, @prisma/client, and engine binaries).
COPY --from=build /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=build /app/node_modules/.modules.yaml node_modules/.modules.yaml

# Copy the entrypoint script.
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Run migrations at startup, then start the api.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
