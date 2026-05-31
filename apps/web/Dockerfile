FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN --mount=type=cache,id=npm-global,target=/root/.npm npm install -g pnpm@10.18.3

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/templates/package.json ./packages/templates/
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM deps AS builder

COPY packages ./packages
COPY apps/web ./apps/web

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN pnpm --filter @synthex/templates build
RUN pnpm --filter @synthex/frontend build

FROM node:22-alpine AS runtime

RUN --mount=type=cache,id=npm-global,target=/root/.npm npm install -g serve@14.2.5

WORKDIR /app

COPY --from=builder /app/apps/web/dist ./dist

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1

CMD ["serve", "-s", "dist", "-l", "5173"]
