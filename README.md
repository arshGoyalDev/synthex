# Synthex Workspace

## Overview

Synthex is a multi-service cloud IDE and project execution platform. It lets a user:

- sign up or log in with email/password or GitHub OAuth
- create projects from templates, blank language presets, raw workspaces, GitHub repos, or ZIP uploads
- provision an isolated Docker-backed runtime for each project
- edit files through the browser with autosave-backed object storage
- run one-shot commands and stream terminal output live
- start long-running preview servers and expose them through the gateway
- keep project file state, snapshots, execution history, and runtime metadata in sync across services

This repository is a PNPM/Turbo monorepo with two apps, five backend services, and several shared packages.

## Top-Level Structure

```text
.
├── apps
│   ├── api_gateway        # HTTP/WebSocket edge, auth enforcement, docs aggregation, preview proxying
│   └── web                # React frontend
├── services
│   ├── user-service       # auth, user profile, GitHub OAuth token management
│   ├── project-service    # project CRUD, import orchestration, lifecycle state
│   ├── storage-service    # file index, file content persistence, snapshots, ZIP validation/manifests
│   ├── container-service  # Docker container lifecycle, terminal, execution, preview runtime
│   └── execution-service  # execution records, preview records, replay buffers, cleanup
├── packages
│   ├── database           # Prisma client, Redis/MinIO helpers, shared repositories
│   ├── templates          # language registry, template registry, import detection helpers
│   ├── openapi            # shared OpenAPI components
│   ├── eslint-config
│   └── typescript-config
├── scripts
│   └── docker             # runtime preparation helpers
├── docker-compose.yml     # local/full stack orchestration
└── package.json           # workspace scripts
```

## Applications and Services

### `apps/web`

Browser client built with React, Vite, TanStack Router, Zustand, Axios, Socket.IO, Monaco, and Xterm.

### `apps/api_gateway`

Single public edge for HTTP APIs, Swagger docs aggregation, WebSocket fan-out, terminal proxying, and dynamic preview reverse proxy registration.

### `services/user-service`

Owns users, credential auth, refresh token flow, and GitHub OAuth account linkage/token retrieval.

### `services/project-service`

Owns project records, import metadata, runtime config, start/stop orchestration, and project lifecycle status.

### `services/storage-service`

Owns project file metadata/content persistence, MinIO-backed file storage, snapshot indexing, and ZIP manifest generation.

### `services/container-service`

Owns Docker containers, startup/install sequences, terminal sessions, execution runtime, preview runtime, snapshots, and reconciliation of storage mutations into containers.

### `services/execution-service`

Owns execution history and preview session metadata, and coordinates replay/buffer lifecycle around running commands.

## Shared Infrastructure

### PostgreSQL

Source of truth for:

- users
- OAuth accounts
- projects
- project files
- project snapshots
- container logs
- execution logs

### Redis

Used for:

- pub/sub event bus between services
- execution output buffers
- execution ownership metadata
- setup log buffers and setup progress
- transient ZIP upload ownership/session keys
- preview target registration
- cleanup timers and other short-lived coordination state

### MinIO

Used for:

- `user-files`
- `project-files`
- `project-zips`
- `execution-outputs`
- `project-snapshots`

The ZIP import flow now uses direct browser upload with presigned URLs. The browser uploads to MinIO, then the storage service validates the uploaded object and generates the manifest used for import detection.

### Docker

The container service talks to the host Docker daemon through `/var/run/docker.sock` and provisions per-project containers named `synthex-<projectId>`.

## Core Domain Models

The Prisma schema in `packages/database/prisma/schema.prisma` defines the main records:

- `User`: identity and profile
- `OAuthAccount`: external provider linkage and stored GitHub access token/scope
- `Project`: lifecycle state, import metadata, runtime config, template/language selection
- `ProjectFile`: per-file metadata plus inline content for small files
- `ProjectSnapshot`: snapshot index for tar/tar.gz captures of project state
- `ContainerLog`: container/system log storage
- `ExecutionLog`: one-shot command and dev-server execution history

## Request and Event Topology

### Public HTTP Path Shape

All browser API calls go through the gateway:

- `/api/auth/*` → user-service
- `/api/users/*` → user-service
- `/api/projects/*` → project-service
- `/api/execution/*` → execution-service
- `/api/storage/*` → storage-service
- `/terminal/*` → proxied WebSocket path to container-service
- `/preview/:projectId/*` → dynamic runtime preview proxy registered by the gateway

### Pub/Sub Event Families

Important channels used across the system:

- `project:created`, `project:start`, `project:stop`, `project:delete`
- `container:status`, `container:timeout`
- `container:setup:log`, `container:setup:stage`
- `files:snapshot`, `fs:change`, `storage:file:mutation`, `storage:file:list-changed`
- `execution:start`, `execution:input`, `execution:kill`, `execution:output`, `execution:status`, `execution:done`
- `preview:start`, `preview:ready`, `preview:error`, `preview:status`, `preview:output`, `preview:stop`
- `user:cleanup`

## End-to-End Flows

### 1. Email Authentication

1. Frontend calls `/api/auth/signup` or `/api/auth/login`.
2. Gateway forwards to user-service.
3. User-service validates credentials, returns access token, and sets refresh token cookie for login flow.
4. Frontend stores the access token in the auth store and uses it for subsequent requests and socket auth.

### 2. GitHub OAuth

1. Browser opens `/api/auth/github`.
2. User-service drives the GitHub OAuth handshake.
3. Callback stores/updates the user and `OAuthAccount`.
4. Refresh token is set as an HTTP-only cookie.
5. Browser is redirected to `/auth/callback#token=<accessToken>`.
6. Frontend hydrates auth state and loads the dashboard.

### 3. Template/Blank/Raw Project Creation

1. Frontend posts to `/api/projects`.
2. Project-service creates the project with `containerStatus=pending`.
3. Project-service publishes `project:created`.
4. Container-service receives the event, creates/starts the runtime, scaffolds the workspace, optionally installs dependencies, snapshots the result, and publishes container status/setup log events.
5. Project-service updates the project’s `containerStatus` when `container:status` events arrive.
6. Gateway fans the status/log events to the user’s socket rooms.

### 4. GitHub Import

1. Frontend calls `/api/projects/import/github/detect`.
2. Project-service reads GitHub metadata/tree and uses `@synthex/templates` detection helpers.
3. Frontend submits `/api/projects/import/github`.
4. Project-service creates the project with GitHub import metadata and publishes `project:created`.
5. Container-service clones the repo during setup and completes the rest of the runtime flow.

### 5. ZIP Import

1. Frontend requests `/api/storage/upload/zip/init`.
2. Storage-service returns a `zipKey` and presigned `PUT` URL.
3. Browser uploads the ZIP directly to MinIO.
4. Frontend calls `/api/storage/upload/zip/complete`.
5. Storage-service validates the object, enforces ZIP safety limits, extracts manifest info, and returns `filePaths` plus selected config file contents.
6. Frontend posts the manifest to `/api/projects/import/zip/detect`.
7. Frontend creates the imported project with `/api/projects/import/zip`.
8. Project-service stores `zipKey`, publishes `project:created`.
9. Container-service streams the ZIP from MinIO directly into the container filesystem and unzips it without buffering the full archive in Node memory.

### 6. File Editing and Autosave

1. Editor updates local state in the web app.
2. File save calls go to `/api/storage/files/:projectId`.
3. Storage-service writes file content to MinIO and updates `ProjectFile` rows.
4. Storage-service publishes mutation events.
5. Container-service consumes those events and applies the changes inside the running container.
6. Gateway emits filesystem refresh/mutation events to the browser so UI state stays aligned.

### 7. One-Shot Execution

1. Frontend posts `/api/execution`.
2. Execution-service creates an execution record and publishes `execution:start`.
3. Container-service starts the command in the project container.
4. Output is streamed over pub/sub and buffered in Redis.
5. Gateway relays chunks to socket clients in the execution room.
6. Container-service publishes `execution:done`.
7. Execution-service finalizes the execution record and clears locks/buffers as needed.

### 8. Preview Runtime

1. Frontend posts `/api/execution/preview`.
2. Execution-service creates the preview record and publishes `preview:start`.
3. Container-service launches the dev server inside the project container and discovers the host port.
4. Container-service publishes `preview:ready`.
5. Execution-service stores preview metadata and publishes `preview:status`.
6. Gateway registers a dynamic reverse proxy and emits preview status to the browser.
7. Browser opens the preview via gateway-managed `/preview/:projectId/...`.

### 9. Disconnect Cleanup

1. Gateway tracks active sockets per user.
2. When the last socket disconnects, a delayed cleanup timer starts.
3. After the delay, the gateway publishes `user:cleanup`.
4. Container-service tears down the user’s containers.
5. Project-service marks affected projects as stopped.

## Repository Scripts

Important root scripts from `package.json`:

- `pnpm dev`: run package/service dev scripts through Turbo
- `pnpm build`: build everything
- `pnpm check-types`: type-check all workspaces
- `pnpm db:up`, `pnpm db:down`, `pnpm db:reset`: local infra lifecycle
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`: Prisma workflows
- `pnpm docker:build:language-images`: build runtime language images

## Local Setup

### Prerequisites

- Node.js 18+
- PNPM 10+
- Docker and Docker Compose

### 1. Install Dependencies

This repo uses PNPM workspaces, so install dependencies with:

```bash
pnpm install
```

If PNPM is not installed yet:

```bash
npm install -g pnpm
```

### 2. Create Environment File

If you have not created a local env file yet:

```bash
cp .env.example .env
```

Review `.env` and adjust values if needed. For most local setups, the defaults are intended to work as-is.

### 3. Start Infra Only

To start only the shared infrastructure services used for local development:

```bash
docker compose --profile infra up -d --build
```

This starts:

- PostgreSQL
- Redis
- MinIO
- MinIO bucket setup

### 4. Generate Prisma Client and Run Migrations

After infra is up:

```bash
pnpm run db:generate
pnpm run db:migrate
```

If you want the one-command infra/bootstrap path instead, you can also use:

```bash
pnpm run db:setup
```

### 5. Start the Application Services in Dev Mode

Run the monorepo dev command:

```bash
pnpm dev
```

This uses Turbo to start the workspace dev scripts for apps and services.

### 6. Open the App

Once the dev processes are running:

- frontend/gateway entry: `http://localhost:5173` for the Vite app during frontend dev
- API gateway: `http://localhost:3000`
- Swagger/docs entry: `http://localhost:3000/docs`

### 7. Optional: Start the Full Stack with Docker Compose

If you want the full containerized stack instead of local dev processes:

```bash
docker compose --profile full up -d --build
```

This starts infra plus all backend services, gateway, migration job, and the web app container.

### 8. Build Runtime Language Images

Some runtime flows depend on language/base images. Build them with:

```bash
pnpm run docker:build:language-images
```

### 9. Useful Maintenance Commands

Bring infra down:

```bash
docker compose --profile infra down
```

Reset infra volumes:

```bash
pnpm run db:reset
```

Tail compose logs:

```bash
pnpm run db:logs
```

Run type checks:

```bash
pnpm run check-types
```

## Local Runtime Layout

`docker-compose.yml` provisions:

- `postgres`
- `redis`
- `minio`
- `minio-setup`
- `migrate`
- `project-service`
- `user-service`
- `container-service`
- `execution-service`
- `storage-service`
- `api-gateway`
- `web`

The compose file also configures:

- MinIO buckets and ZIP upload CORS
- service-to-service internal URLs
- health checks
- shared network
- Docker socket mount for container-service

## Where to Read Next

- [apps/web/README.md](apps/web/README.md)
- [apps/api_gateway/README.md](apps/api_gateway/README.md)
- [services/user-service/README.md](services/user-service/README.md)
- [services/project-service/README.md](services/project-service/README.md)
- [services/storage-service/README.md](services/storage-service/README.md)
- [services/container-service/README.md](services/container-service/README.md)
- [services/execution-service/README.md](services/execution-service/README.md)
