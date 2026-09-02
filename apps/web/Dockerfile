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
COPY apps/web/ apps/web/

# Vite build → apps/web/dist/
RUN pnpm --filter @scheduler/web build

# ---- Production stage ----
FROM nginx:alpine AS production

# Remove the default nginx site.
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config (SPA routing + /api proxy).
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static assets.
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
