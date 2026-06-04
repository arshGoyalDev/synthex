# API Gateway

## Purpose

`apps/api_gateway` is the single public edge for the backend. It is responsible for:

- forwarding browser API requests to internal services
- enforcing auth on protected routes
- terminating Socket.IO connections from the browser
- relaying backend pub/sub events to socket rooms
- proxying `/terminal` WebSocket traffic to container-service
- registering and restoring dynamic `/preview/:projectId/*` reverse proxies
- aggregating per-service OpenAPI specs into a single docs surface

## Source Structure

```text
src
├── config
│   ├── database.ts
│   ├── index.ts
│   ├── socket.ts
│   └── subscriber.ts
├── docs
│   ├── aggregator.ts
│   └── docs.router.ts
├── middlewares
│   └── auth.middleware.ts
├── proxy
│   ├── preview.proxy.ts
│   ├── proxy.middleware.ts
│   └── routes.ts
├── utils
│   └── jwt.ts
└── index.ts
```

## Request Routing

Static proxy registrations are defined in `src/proxy/routes.ts`:

- `/api/auth` → user-service, unprotected
- `/api/users` → user-service, protected
- `/api/projects` → project-service, protected
- `/api/containers` → container-service, protected
- `/api/execution` → execution-service, protected
- `/api/storage/upload` → storage-service, protected, with path rewrite from `/api/storage`
- `/api/storage` → storage-service, protected

`src/proxy/proxy.middleware.ts` applies:

- `authMiddleware` to protected routes
- `http-proxy-middleware`
- path rewrites
- 502 fallback on proxy errors

## WebSocket Responsibilities

`src/config/socket.ts` owns browser-facing Socket.IO behavior.

### Connection Auth

- client must send access token in `socket.handshake.auth.token`
- gateway verifies it using `verifyAccessToken`
- verified connections are attached to `user:<userId>`

### Supported Socket Commands

- `execution:join`
- `execution:leave`
- `execution:input`
- `preview:join`
- `preview:leave`
- `setup:join`
- `setup:leave`

### Replay and Recovery Behavior

When a client joins execution/setup rooms, the gateway replays buffered Redis content:

- execution output chunks from `execution:buffer:<executionId>`
- setup log lines from `setup:buffer:<projectId>`
- setup status/progress from `setup:status:<projectId>` and `setup:progress:<projectId>`

### Disconnect Cleanup

The gateway tracks active sockets by user. When the final socket disconnects:

1. a delayed cleanup timer is scheduled
2. if no new sockets reconnect, the gateway publishes `user:cleanup`
3. downstream services tear down containers and reconcile project state

## Pub/Sub Subscribers

`src/config/subscriber.ts` subscribes to backend events and fans them out to socket rooms.

### Consumed Channels

- `container:status`
- `storage:file:mutation`
- `storage:file:list-changed`
- `execution:output`
- `execution:status`
- `execution:done`
- `preview:status`
- `preview:output`
- `container:setup:log`
- `container:setup:stage`

### Emitted Socket Events

- `container:status`
- `container:fs:change`
- `container:fs:refresh`
- `execution:output`
- `execution:status`
- `execution:done`
- `preview:status`
- `preview:output`
- `setup:log`
- `setup:stage`

## Terminal Proxy

`index.ts` creates a dedicated proxy for `/terminal`:

- target: container-service
- supports WebSocket upgrade traffic
- logs upgrade attempts and proxy failures

This is separate from Socket.IO. It is used for interactive shell streaming into project containers.

## Dynamic Preview Proxy

`src/proxy/preview.proxy.ts` handles per-project preview routing.

Responsibilities:

- register a proxy when a preview becomes ready
- remove a proxy when a preview stops or errors
- restore proxies on gateway startup from Redis state

This lets the browser access project dev servers through gateway-managed routes rather than direct container ports.

## Docs Aggregation

`src/docs` exposes a unified docs surface:

- `/docs`
- `/docs/openapi.json`

The gateway fetches/combines service-level OpenAPI specs so the public backend shape can be inspected from one place.

## Main Startup Flow

`src/index.ts` performs:

1. Express app setup with CORS
2. HTTP server creation
3. Socket.IO server creation
4. socket service initialization
5. pub/sub subscriber registration
6. terminal proxy setup
7. docs router setup
8. static proxy registration
9. preview proxy initialization and restore
10. server listen on `API_GATEWAY_PORT`

## Dependencies on Other Services

The gateway does not own business logic. It depends on:

- user-service for auth and user APIs
- project-service for project and import APIs
- storage-service for file and ZIP APIs
- execution-service for execution and preview APIs
- container-service for terminal transport
- Redis/pubsub for live event fan-out and preview restoration

## Failure Handling

- protected routes fail early in `authMiddleware`
- proxy failures return `502 Service unavailable`
- invalid socket tokens reject the connection
- room joins are gated by project/execution ownership checks via database/Redis lookups
