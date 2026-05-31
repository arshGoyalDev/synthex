FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN --mount=type=cache,id=npm-global,target=/root/.npm npm install -g pnpm@10.18.3

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/templates/package.json ./packages/templates/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY services/project-service/package.json ./services/project-service/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM deps AS builder

COPY packages ./packages
COPY services/project-service ./services/project-service

RUN pnpm --filter @synthex/database build
RUN pnpm --filter @synthex/templates build
RUN pnpm --filter @synthex/project-service build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN --mount=type=cache,id=npm-global,target=/root/.npm npm install -g pnpm@10.18.3

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/templates/package.json ./packages/templates/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY services/project-service/package.json ./services/project-service/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod --store-dir=/pnpm/store

COPY scripts/docker/prepare-runtime-workspace.mjs ./scripts/docker/prepare-runtime-workspace.mjs
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/src/generated ./packages/database/dist/generated
COPY --from=builder /app/packages/templates/dist ./packages/templates/dist
COPY --from=builder /app/services/project-service/dist ./services/project-service/dist

RUN node ./scripts/docker/prepare-runtime-workspace.mjs ./packages/database ./packages/templates

RUN addgroup -S synthex && adduser -S synthex -G synthex
USER synthex

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/health >/dev/null || exit 1

CMD ["node", "services/project-service/dist/index.js"]
