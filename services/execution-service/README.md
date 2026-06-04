# Execution Service

## Purpose

`services/execution-service` owns persisted execution and preview metadata.

It is responsible for:

- recording command execution lifecycle
- exposing execution history and details to the frontend
- initiating execution and preview flows through pub/sub
- buffering/retrieving execution output
- reacting to runtime completion/error events
- cleaning up stale executions

It does not execute commands itself. Container-service does the actual runtime work.

## Source Structure

```text
src
├── config
│   ├── database.ts
│   ├── index.ts
│   └── subscribers.ts
├── jobs
│   └── stale.watcher.ts
├── modules
│   └── execution
│       ├── execution.controller.ts
│       ├── execution.repository.ts
│       ├── execution.routes.ts
│       ├── execution.schema.ts
│       └── execution.service.ts
├── utils
│   ├── AppError.ts
│   ├── lock.ts
│   └── projectAccess.ts
├── index.ts
└── openapi.ts
```

## HTTP Surface

Routes are mounted at `/`.

- `POST /preview`
- `DELETE /preview/:projectId`
- `GET /project/:projectId`
- `POST /`
- `GET /:executionId`
- `GET /:executionId/buffer`
- `DELETE /:executionId`
- `GET /health`
- `GET /openapi.json`

## Core Responsibilities

### One-Shot Execution API

`POST /`

- validates execution request
- creates/persists execution record
- publishes `execution:start`
- returns `executionId` immediately

### Execution Inspection APIs

- `GET /:executionId` returns stored execution metadata
- `GET /project/:projectId` returns history for a project
- `GET /:executionId/buffer` returns buffered output chunks for reconnect/replay

### Execution Cancellation

`DELETE /:executionId`

- marks the execution as being killed
- publishes `execution:kill`

### Preview APIs

- `POST /preview` starts a dev-server flow by publishing `preview:start`
- `DELETE /preview/:projectId` publishes `preview:stop`

## Event Subscriptions

`src/config/subscribers.ts` consumes:

### `execution:done`

- finalizes execution record
- stores exit code, duration, status, error metadata
- logs completion state transitions

### `preview:ready`

- records preview availability metadata such as host/URL state
- enables gateway-side preview routing

### `preview:error`

- marks preview state as failed and publishes/records the failure

### `execution:project:delete`

- removes execution history for deleted projects

## Buffered Output and Locks

This service works with shared helpers from `@synthex/database` and local utilities to manage:

- replay buffers for execution output
- execution/project locks
- metadata needed by gateway socket joins

These pieces allow:

- reconnect-safe output replay
- prevention of overlapping executions where disallowed
- cleanup after completion or failure

## Background Job: Stale Watcher

`src/jobs/stale.watcher.ts` runs every 5 minutes.

It finds non-dev-server executions that have been `queued` or `running` for longer than 35 minutes and:

- marks them failed
- publishes `execution:kill`
- releases locks
- clears Redis buffers

This protects the system from orphaned execution records if the runtime side crashes or hangs.

## Data Ownership

Primary table:

- `ExecutionLog`

Important fields:

- `executionId`
- `projectId`
- `userId`
- `status`
- `command`
- `output`
- `error`
- `exitCode`
- `durationMs`
- `completedAt`
- `isDevServer`

## End-to-End Execution Flow

1. frontend calls execution-service
2. service creates execution record and publishes `execution:start`
3. container-service runs the command and streams output
4. gateway relays live chunks to browser sockets
5. container-service publishes `execution:done`
6. execution-service finalizes persistence state

## End-to-End Preview Flow

1. frontend calls `POST /preview`
2. service validates and publishes `preview:start`
3. container-service launches preview server
4. container-service publishes `preview:ready` or `preview:error`
5. execution-service records preview state
6. gateway registers/removes preview proxies and informs the browser

## External Dependencies

- PostgreSQL for `ExecutionLog`
- Redis for buffers, locks, and metadata
- container-service for actual command/preview runtime
- project-service ownership context
- API gateway for browser-facing socket replay/fan-out
