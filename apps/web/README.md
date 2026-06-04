# Web App

## Purpose

`apps/web` is the browser client for Synthex. It handles:

- public landing and auth screens
- project creation/import UI
- dashboard and project list UI
- full editor workspace
- setup/install progress visualization
- terminal/execution/preview UX
- file editing and synchronization

It talks only to the API gateway and Socket.IO gateway, never directly to internal services except presigned ZIP uploads to MinIO.

## Stack

- React 19
- Vite
- TanStack Router
- Zustand
- Axios
- Socket.IO client
- Monaco editor
- Xterm
- Framer Motion
- Tailwind-style utility CSS from `index.css`

## Source Structure

```text
src
├── components
│   ├── dashboard     # home/dashboard UI
│   ├── editor        # IDE/editor/preview/output panels
│   ├── landing       # marketing-style landing page
│   ├── ui            # low-level input primitives
│   └── icons
├── contexts
│   └── SocketContext.tsx
├── hooks
│   ├── useExecution.ts
│   ├── useFileSync.ts
│   ├── usePreview.ts
│   ├── useSaveFile.ts
│   └── useTerminalSocket.ts
├── lib
│   ├── api.ts        # Axios instance + token refresh logic
│   └── tokenRef.ts   # shared mutable token reference
├── routes
│   ├── __root.tsx
│   ├── index.tsx
│   ├── auth
│   └── project
├── services          # typed API wrappers
├── stores            # Zustand stores
├── types             # project/auth shapes
└── utils             # Monaco language helpers and similar utilities
```

## Routing

### `src/routes/__root.tsx`

- runs auth bootstrap with `checkAuth()`
- blocks initial render behind the auth check spinner
- wraps the app in `SocketProvider`

### `src/routes/index.tsx`

- unauthenticated users see `LandingPage`
- authenticated users see `Dashboard`

### `src/routes/auth/login.tsx`

- email/password sign-in form
- GitHub OAuth entry via `/api/auth/github`

### `src/routes/auth/signup.tsx`

- username/email/password registration form
- basic client-side password confirmation validation

### `src/routes/auth/callback.tsx`

- receives GitHub OAuth callback token from the backend
- hydrates auth state and redirects to `/`

### `src/routes/project/index.tsx`

Project creation/import screen supporting:

- GitHub repo import
- ZIP import
- template-based project creation
- blank language-based project creation
- raw workspace creation

Important ZIP behavior:

- validates `.zip` extension and 100 MB client-side limit
- requests upload session from `/api/storage/upload/zip/init`
- uploads directly to MinIO using the presigned URL
- finalizes upload with `/api/storage/upload/zip/complete`
- sends returned manifest data to `/api/projects/import/zip/detect`

### `src/routes/project/$projectId.tsx`

Main IDE/workspace route. It:

- loads project metadata and env vars
- opens setup-log socket rooms
- reacts to container status changes
- drives run/preview actions
- coordinates editor state, setup state, and runtime config
- opens the editor early during install when supported

## Services Layer

### `src/services/project.service.ts`

Wrappers for:

- `GET /api/projects/me`
- `GET /api/projects/:id`
- `GET /api/projects/:id/env`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `PUT /api/projects/:id/config`
- `POST /api/projects/:id/start`
- `POST /api/projects/:id/stop`
- `DELETE /api/projects/:id`

`startProject()` also de-duplicates concurrent start requests in memory.

### `src/services/import.service.ts`

Wrappers for:

- GitHub repo listing, detection, import
- ZIP upload init
- direct object-store upload
- ZIP upload completion
- ZIP manifest detection
- ZIP import

### `src/services/execution.service.ts`

Wrappers for:

- one-shot execution start
- preview start/stop
- execution lookup/history
- execution buffer replay lookup
- execution kill

### `src/services/storage.service.ts`

Wrappers for file CRUD against the storage service through the gateway.

## State Stores

### `auth.store.ts`

Owns:

- access token state
- current user profile
- login/signup/logout flows
- refresh/check-auth bootstrap
- OAuth token hydration

### `project.store.ts`

Owns loaded project list and project-level mutations used across dashboard/editor views.

### `editor.store.ts`

Owns editor-local workspace state such as:

- open tabs
- selected file
- explorer state
- right-panel state
- transient editor context

### `setup.store.ts`

Owns setup/install UX state:

- setup log lines
- stage transitions
- progress
- open-editor-early behavior
- install completion state

## Hooks

### `useExecution.ts`

- joins execution socket rooms
- replays buffered output
- decodes base64 output chunks
- tracks command status and output state

### `usePreview.ts`

- tracks preview state and preview URL/access token
- starts/stops previews
- listens to preview socket events

### `useTerminalSocket.ts`

- manages interactive terminal connectivity through the gateway/container-service path

### `useFileSync.ts` and `useSaveFile.ts`

- coordinate storage writes
- keep local editor state aligned with backend persistence
- react to remote file list/mutation signals

## Socket Integration

The web app connects to the API gateway Socket.IO server using the access token from the auth store.

Main room/event families used by the UI:

- `execution:join`, `execution:leave`, `execution:output`, `execution:status`, `execution:done`
- `preview:join`, `preview:leave`, `preview:status`, `preview:output`
- `setup:join`, `setup:leave`, `setup:log`, `setup:stage`, `setup:status`
- `container:status`
- `container:fs:change`, `container:fs:refresh`

## Major UI Areas

### Dashboard

`src/components/dashboard` includes:

- project list/grid
- project cards
- creation modal entry points
- activity/summary UI
- sidebar navigation

### Editor

`src/components/editor` includes:

- layout shell
- file explorer
- tabs and breadcrumbs
- Monaco code editor
- markdown preview
- terminal
- output panel
- preview panel
- setup log panel
- project settings modal
- install status banner
- file palette / global search

### Landing/Auth

`src/components/landing` plus auth routes provide public-facing onboarding and authentication UI.

## Auth and API Behavior

`src/lib/api.ts` configures Axios with:

- `baseURL = import.meta.env.VITE_SERVER_URL`
- bearer token attachment from `tokenRef`
- transparent refresh retry on 401 via `/api/auth/refresh`
- redirect to `/auth/login` if refresh fails

## ZIP Import Data Flow

```text
Browser
  -> POST /api/storage/upload/zip/init
  -> PUT presigned MinIO URL
  -> POST /api/storage/upload/zip/complete
  -> POST /api/projects/import/zip/detect
  -> POST /api/projects/import/zip
  -> navigate to /project/:id
```

## What This App Does Not Own

The web app does not:

- issue direct database queries
- talk directly to internal microservice URLs
- generate preview proxies
- execute commands locally
- parse ZIPs client-side for detection

Those concerns are delegated to the gateway and backend services.
