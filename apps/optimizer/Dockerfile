# ---- Build stage ----
FROM node:22-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/optimizer/package.json apps/optimizer/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/optimizer/ apps/optimizer/

# Build contracts first (the optimizer resolves @scheduler/contracts from dist/).
RUN pnpm --filter @scheduler/contracts build

RUN pnpm --filter @scheduler/optimizer build

# ---- Production stage ----
FROM node:22-alpine AS production

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY apps/optimizer/package.json apps/optimizer/

# --ignore-scripts: highs' postinstall downloads WASM binaries, but we copy
# the already-installed ones from the build stage instead.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/apps/optimizer/dist apps/optimizer/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json packages/contracts/
COPY --from=build /app/packages/config packages/config

# Copy the pnpm store (contains highs WASM binaries and all dependencies).
COPY --from=build /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=build /app/node_modules/.modules.yaml node_modules/.modules.yaml

CMD ["node", "apps/optimizer/dist/main.js"]
