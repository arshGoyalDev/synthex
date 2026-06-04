# Container Service

## Purpose

`services/container-service` is the runtime engine of Synthex.

It is responsible for:

- creating and starting per-project Docker containers
- restoring project state from snapshots/object storage
- scaffolding template/blank/raw projects
- importing GitHub repos and ZIP archives
- running dependency installation
- publishing setup progress and status
- streaming interactive terminal sessions
- executing one-shot commands
- running and managing preview servers
- reconciling storage-side file mutations into the live container
- taking snapshots back into storage

This service is the only service that talks directly to Docker.

## Source Structure

```text
src
├── config
│   ├── database.ts
│   ├── index.ts
│   └── subscriber.ts
├── modules
│   ├── container
│   │   └── container.service.ts
│   ├── execution
│   │   └── execution.handler.ts
│   ├── preview
│   │   └── preview.handler.ts
│   └── terminal
│       ├── terminal.handler.ts
│       └── terminal.service.ts
├── utils
│   ├── AppError.ts
│   ├── checksum.ts
│   ├── dockerStream.ts
│   ├── ignore.ts
│   ├── jwt.ts
│   ├── mime.ts
│   ├── ports.ts
│   ├── restore.ts
│   └── snapshots.ts
├── index.ts
└── openapi.ts
```

## Public Surface

This service exposes:

- `GET /health`
- `GET /openapi.json`
- Socket.IO terminal transport on `/terminal/`

Most orchestration happens through Redis pub/sub rather than regular REST endpoints.

## Main Runtime Concerns

### Project Container Provisioning

`modules/container/container.service.ts` handles:

- selecting runtime image
- creating the Docker container
- starting existing containers when possible
- restoring latest snapshot
- applying stored file state and delete tombstones
- executing setup/install commands
- snapshotting post-setup state

Container names follow `synthex-<projectId>`.

### Template and Language Setup

The service relies on `@synthex/templates`:

- `LANGUAGES`
- `TEMPLATES`
- preview-oriented template metadata

This drives:

- runtime base image selection
- install commands
- setup commands
- post-setup commands

### ZIP Import

ZIP imports no longer buffer the whole archive into Node memory.

Current flow:

1. container-service gets a MinIO object stream for `project-zips/<zipKey>`
2. `setupZipImport()` starts a Docker exec with stdin attached
3. the ZIP stream is piped directly into `/tmp/import.zip` inside the container
4. `unzip` extracts it into `/workspace/<projectName>`
5. a single top-level directory is flattened when present

This avoids the old pattern of:

- buffering the full ZIP
- base64-encoding it
- echoing it into the container

### GitHub Import

GitHub imports clone the repository inside the runtime during setup.

### Snapshots

The service can:

- capture a snapshot of the workspace
- upload the archive to MinIO
- publish a `files:snapshot` manifest event
- wait until storage-service confirms indexing
- restore the latest snapshot on restart

## Setup Log Streaming

Setup/install progress is visible live in the frontend.

This service publishes:

- `container:setup:log`
- `container:setup:stage`
- `container:status`

It also stores Redis buffers for reconnect/replay:

- `setup:buffer:<projectId>`
- `setup:status:<projectId>`
- `setup:progress:<projectId>`

## Execution Runtime

`modules/execution/execution.handler.ts` handles one-shot command execution.

Responsibilities:

- create a Docker exec
- attach stdin/stdout/stderr
- stream output frames
- publish `execution:output`
- react to `execution:input`
- handle `execution:kill`
- publish `execution:done`

## Preview Runtime

`modules/preview/preview.handler.ts` handles long-running dev servers.

Responsibilities:

- run the preview command in the container
- discover/bind a host port
- persist preview target metadata in Redis
- publish preview readiness/error status
- stop and clean up preview sessions

## Terminal Transport

`modules/terminal` provides browser terminal support through Socket.IO/WebSocket bridging.

The terminal path is `/terminal/`, and the API gateway proxies upgrade traffic there.

## Event Subscriptions

`src/config/subscriber.ts` consumes:

- `project:created`
- `project:start`
- `project:stop`
- `project:delete`
- `container:timeout`
- `user:cleanup`
- `storage:file:mutation`
- `execution:start`
- `execution:kill`
- `preview:start`
- `preview:stop`

### Behavior per Event

#### `project:created` / `project:start`

- run full container setup path
- choose import/template/blank/raw flow
- publish status and setup progress

#### `project:stop`

- stop project runtime
- publish `container:status = stopped`

#### `project:delete`

- remove container resources and related coordination keys

#### `container:timeout`

- tear down stalled setup
- publish timeout status

#### `user:cleanup`

- stop/clean all containers for a disconnected user

#### `storage:file:mutation`

- replay persisted file mutations into the live workspace

#### `execution:start` / `execution:kill`

- start or stop one-shot commands

#### `preview:start` / `preview:stop`

- start or stop dev-server previews

## Dependencies

- Docker daemon via mounted socket
- Redis/pubsub for orchestration and live streaming
- MinIO for snapshots, files, ZIP imports
- project-service for lifecycle triggers
- storage-service for snapshot indexing and storage mutation coordination
- execution-service for persisted execution/preview metadata

## Startup Flow

`src/index.ts`:

1. configures CORS and JSON parsing
2. creates HTTP server and Socket.IO server for terminal traffic
3. ensures buckets exist
4. registers terminal handlers
5. registers pub/sub subscribers
6. starts listening

## Important Operational Notes

- this service is stateful with respect to live containers
- many actions are fire-and-forget from subscriber handlers, with errors reflected back through status events
- preview and execution streams rely heavily on Redis and gateway socket fan-out
- setup flows take snapshots so the editor and storage index can converge on the same workspace state
