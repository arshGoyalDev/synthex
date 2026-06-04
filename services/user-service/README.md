# User Service

## Purpose

`services/user-service` owns identity, authentication, refresh flow, user profile APIs, and GitHub OAuth account linkage.

It is the authority for:

- user creation
- credential login
- refresh token lifecycle
- current-user profile retrieval/update
- account deletion
- GitHub OAuth login
- retrieval of stored GitHub access tokens for internal import flows

## Source Structure

```text
src
├── config
│   ├── database.ts
│   └── index.ts
├── middlewares
├── modules
│   ├── auth
│   │   ├── auth.controller.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.schema.ts
│   │   └── auth.service.ts
│   └── user
│       ├── user.controller.ts
│       ├── user.repository.ts
│       ├── user.routes.ts
│       ├── user.schema.ts
│       └── user.service.ts
├── utils
│   ├── AppError.ts
│   ├── encryption.ts
│   └── token.ts
├── index.ts
└── openapi.ts
```

## HTTP Surface

The service mounts both auth and user routes at `/`.

### Auth Routes

- `POST /signup`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `GET /github`
- `GET /github/callback`
- `GET /internal/github/token`

### User Routes

- `GET /me`
- `PUT /me`
- `DELETE /me`
- `GET /:id`

### Utility Routes

- `GET /health`
- `GET /openapi.json`

## Auth Responsibilities

### Signup

- validates input with Zod
- hashes password
- creates the user record
- returns auth tokens / authenticated response shape

### Login

- validates email/password
- loads user by email
- compares password hash
- returns an access token
- sets refresh token cookie

### Refresh

- reads the refresh token from cookies
- validates and rotates/refreshes access state
- returns a fresh access token

### Logout

- clears the refresh token cookie

## GitHub OAuth Flow

Configured in `modules/auth/auth.routes.ts` using `passport-github2`.

Behavior:

1. browser hits `GET /github`
2. GitHub OAuth consent flow begins
3. callback hits `GET /github/callback`
4. service fetches the GitHub user profile
5. if profile email is missing, service fetches `/user/emails`
6. service upserts the OAuth-linked user via `AuthService.handleOAuthLogin`
7. stored GitHub access token and token scope are persisted in `OAuthAccount`
8. refresh token cookie is set
9. browser redirects to frontend callback with access token in the URL fragment

### Internal Token Endpoint

`GET /internal/github/token` is used by project-service to import private repositories. It returns the stored GitHub access token for the authenticated internal call path.

## Data Ownership

This service reads/writes:

- `User`
- `OAuthAccount`

It also indirectly supports other services by making GitHub import tokens available for internal use.

## Security Model

- password hashes are stored, not raw passwords
- refresh tokens are cookie-based
- GitHub access tokens are stored against `OAuthAccount`
- internal GitHub token access is protected through internal headers/config
- CORS origin is restricted using `env.ORIGIN`

## Startup

`src/index.ts` configures:

- CORS
- JSON parsing
- cookie parser
- Passport initialization
- OpenAPI endpoint
- auth and user routes
- centralized error handler

There are no background jobs and no pub/sub subscribers in this service.

## Key Utilities

### `utils/token.ts`

Token creation/verification helpers used for access and refresh flow.

### `utils/encryption.ts`

Support code for encrypted token persistence/handling.

### `utils/AppError.ts`

Shared service-local error abstraction for consistent HTTP failures.

## External Dependencies

- PostgreSQL through the shared database package
- Redis configuration support through shared database helpers
- GitHub OAuth and GitHub REST API
- frontend origin for browser redirect/cookie behavior
