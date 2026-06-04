# Project Service

## Purpose

`services/project-service` owns project metadata and lifecycle orchestration.

It is the system of record for:

- project CRUD
- import metadata
- runtime config metadata
- per-project environment variable storage
- start/stop requests
- project container lifecycle status

It does not build containers itself. Instead, it publishes orchestration events that container-service consumes.

## Source Structure

```text
src
├── config
│   ├── database.ts
│   ├── index.ts
│   └── subscriber.ts
├── jobs
│   └── timeout.watcher.ts
├── modules
│   ├── import
│   │   ├── import.controller.ts
│   │   ├── import.routes.ts
│   │   ├── import.schema.ts
│   │   └── import.service.ts
│   └── project
│       ├── project.controller.ts
│       ├── project.routes.ts
│       ├── project.schema.ts
│       └── project.service.ts
├── utils
│   ├── AppError.ts
│   └── project.ts
├── index.ts
└── openapi.ts
```

## HTTP Surface

Routes are mounted at `/`.

### Project Routes

- `GET /me`
- `GET /:id`
- `GET /:id/env`
- `POST /`
- `PATCH /:id`
- `DELETE /:id`
- `POST /:id/start`
- `POST /:id/stop`
- `PUT /:id/config`

### Import Routes

- `GET /import/github/repos`
- `POST /import/github/detect`
- `POST /import/github`
- `POST /import/zip/detect`
- `POST /import/zip`

### Utility Routes

- `GET /health`
- `GET /openapi.json`

## Core Responsibilities

### Project CRUD

`modules/project` manages:

- project creation
- renaming/updating descriptions
- project deletion
- runtime config lookup/update
- ownership checks
- start/stop dispatch

### Runtime Config

Each project can persist:

- `runCommand`
- `previewCommand`
- `previewPort`
- `installCommand`
- `envVars`
- `autoSaveEnabled`

These values are used by the editor and by downstream execution/preview flows.

### Import Orchestration

`modules/import/import.service.ts` handles:

- GitHub repository listing for the current user
- GitHub repository detection using tree/config file inspection
- GitHub import project creation
- ZIP manifest detection using the manifest produced by storage-service
- ZIP import project creation

For GitHub imports, the service retrieves the stored GitHub token from user-service’s internal token endpoint.

For ZIP imports, the service verifies ZIP ownership using Redis keys created by storage-service after upload completion.

## Event Publishing

This service publishes:

- `project:created`
- `project:start`
- `project:stop`
- `project:delete`

Payloads include the project id, folder/project name, owning user, template/languages, and import metadata as needed.

These events are consumed mainly by container-service, storage-service, and execution-service.

## Event Subscriptions

`src/config/subscriber.ts` listens for:

### `container:status`

- updates `Project.containerStatus`
- keeps the database aligned with runtime state transitions such as `starting`, `installing`, `ready`, `stopped`, `error`, and `timeout`

### `user:cleanup`

- bulk marks a disconnected user’s projects as `stopped`

## Background Job: Timeout Watcher

`src/jobs/timeout.watcher.ts` runs every 5 seconds.

It finds projects whose `containerStatus` is still `pending` or `starting` after 20 minutes and publishes:

- `container:timeout`

This lets container-service clean up stalled setup attempts and notify the user.

## Data Ownership

The service primarily owns the `Project` table. It does not own file rows, snapshot rows, or execution rows, but it references their lifecycle indirectly by publishing delete/start/stop events.

Important `Project` fields:

- `type`
- `template`
- `languages`
- `containerStatus`
- `importSource`
- `repoUrl`
- `repoBranch`
- `zipKey`
- `runCommand`
- `previewCommand`
- `previewPort`
- `installCommand`
- `envVars`
- `autoSaveEnabled`

## Important Data Flows

### Create Project

1. frontend posts create request
2. project row is created
3. `project:created` is published
4. container-service provisions runtime
5. `container:status` events flow back and update project state

### Start Existing Project

1. frontend posts `/projects/:id/start`
2. service validates ownership and current state
3. publishes `project:start`
4. container-service restores or rebuilds runtime

### Stop Project

1. frontend posts `/projects/:id/stop`
2. service publishes `project:stop`
3. container-service stops runtime and emits `container:status`

### Delete Project

1. frontend sends delete request
2. project-service deletes the project record
3. publishes cleanup events for container, storage, and execution concerns

## External Dependencies

- user-service for GitHub token retrieval
- container-service for actual runtime lifecycle work
- Redis/pubsub for orchestration
- `@synthex/templates` for import detection logic
