#!/bin/sh
# Entrypoint for the API container.
# 1. Run Prisma migrations (ensures the DB schema is up to date).
# 2. Start the NestJS API.

set -e

# Find the prisma binary in the pnpm store.
# pnpm installs packages in node_modules/.pnpm/<name>@<version>/node_modules/<name>/
PRISMA_BIN=$(find /app/node_modules/.pnpm -path "*/prisma/build/index.js" | head -1)

if [ -z "$PRISMA_BIN" ]; then
  echo "ERROR: Could not find prisma binary in node_modules/.pnpm"
  exit 1
fi

echo "Running Prisma migrations..."
cd /app/apps/api
node "$PRISMA_BIN" migrate deploy

echo "Starting API server..."
cd /app
exec node apps/api/dist/main.js
