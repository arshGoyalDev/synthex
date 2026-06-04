# Storage Service

## Purpose

`services/storage-service` owns persisted project file state and ZIP intake.

Its responsibilities include:

- project file CRUD
- small-file inline content plus large-file MinIO-backed content
- snapshot indexing and reconciliation
- file list reconstruction
- ZIP upload finalization, validation, and manifest generation
- project data cleanup in storage

It is the authority for what files exist in a project from the platform’s perspective.

## Source Structure

```text
src
├── config
│   ├── database.ts
│   ├── index.ts
│   └── subscriber.ts
├── modules
│   ├── files
│   │   ├── files.controller.ts
│   │   ├── files.repository.ts
│   │   ├── files.routes.ts
│   │   └── files.service.ts
│   ├── snapshots
│   │   └── snapshot.repository.ts
│   └── upload
│       └── upload.routes.ts
├── utils
│   ├── AppError.ts
│   ├── mime.ts
│   └── projectAccess.ts
├── index.ts
└── openapi.ts
```

## HTTP Surface

### File Routes

Mounted under `/files`:

- `GET /files/:projectId/latest-snapshot`
- `GET /files/:projectId`
- `POST /files/:projectId`
- `GET /files/:projectId/*`
- `PUT /files/:projectId/*`
- `DELETE /files/:projectId/*`

### ZIP Upload Routes

Mounted under `/upload`:

- `POST /upload/zip/init`
- `POST /upload/zip/complete`

### Utility Routes

- `GET /health`
- `GET /openapi.json`

## File Storage Model

`ProjectFile` rows track:

- `projectId`
- `filePath`
- `fileName`
- optional inline `content`
- `minioPath`
- `sizeBytes`
- `mimeType`

Behavior:

- smaller files can be stored with inline content in Postgres
- canonical object storage path lives in MinIO
- metadata is always indexed in the database

## Buckets and Object Storage

The service ensures required buckets exist on startup and uses MinIO for:

- live project files
- snapshots
- uploaded ZIPs used for import

The ZIP path now uses a dedicated presigned-upload flow rather than multipart upload through the application server.

## ZIP Import Flow

`modules/upload/upload.routes.ts` implements the ZIP intake pipeline.

### `POST /upload/zip/init`

Responsibilities:

- authenticate the user from `x-user-id`
- validate filename and size
- ensure `.zip` extension
- create a temporary Redis upload session
- return:
  - `zipKey`
  - presigned `uploadUrl`
  - required upload headers
  - expiry
  - normalized `originalName`

### Browser Upload

The browser uploads directly to MinIO using the presigned URL. The storage service does not receive the ZIP body.

### `POST /upload/zip/complete`

Responsibilities:

- verify the pending upload session
- verify uploaded object existence and expected size
- download the ZIP object to a temp file
- validate archive safety constraints
- extract a manifest:
  - `filePaths`
  - selected config file contents (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`)
- store ownership key in Redis so project-service can authorize ZIP import

### ZIP Safety Checks

The service enforces:

- max upload size: 100 MB
- max uncompressed size: 200 MB
- max entry count: 10,000
- no absolute paths
- no `.` / `..` traversal segments
- temp upload session TTL
- upload ownership validation

## File Mutation Flow

When a file is saved, renamed, or deleted:

1. storage-service validates ownership/access
2. writes to MinIO and/or DB
3. updates file index rows
4. publishes mutation/list-changed events
5. container-service applies those changes inside the running runtime
6. gateway relays file-system notifications back to the browser

## Snapshot Handling

The container-service periodically captures a snapshot of the project filesystem and publishes a `files:snapshot` event.

Storage-service receives the event and:

- stores snapshot metadata
- rebuilds or reconciles the file index from the snapshot manifest
- marks snapshot indexing completion in Redis for container-side coordination

It also knows how to:

- extract file content from snapshot archives
- rebuild the file index from the latest snapshot
- delete stale snapshot data during project cleanup

## Event Subscriptions

`src/config/subscriber.ts` consumes:

### `files:snapshot`

- calls `FilesService.handleSnapshot`
- persists snapshot metadata and indexes file manifests

### `fs:change`

- currently reacts to delete events
- removes file records or stored content when the runtime signals a deletion

### `storage:project:delete`

- removes project files, snapshots, tombstones, and related MinIO objects

## Published Events

While the exact publish calls live inside `FilesService`, this service is responsible for emitting the storage-side filesystem event stream used by gateway and container-service:

- `storage:file:mutation`
- `storage:file:list-changed`

## Startup Flow

`src/index.ts`:

1. configures CORS and JSON parsing
2. exposes health/OpenAPI
3. mounts file and upload routes
4. ensures MinIO buckets for snapshots/files
5. registers subscribers
6. starts the HTTP server

## External Dependencies

- PostgreSQL for file and snapshot metadata
- Redis for ownership, TTL, and coordination keys
- MinIO for actual file/blob storage
- project-service ownership context
- container-service for snapshot production and runtime mutation reconciliation
