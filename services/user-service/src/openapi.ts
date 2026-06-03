import type { OpenAPIObject } from "openapi3-ts/oas31";
import { baseComponents, bearerSecurity, commonResponses } from "@synthex/openapi";

const spec: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "User Service",
    version: "1.0.0",
    description:
      "Handles user authentication (email/password + GitHub OAuth) and user profile management.",
  },
  tags: [
    { name: "Auth", description: "Registration, login, token refresh, logout, OAuth" },
    { name: "Users", description: "User profile read/update/delete" },
  ],
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    "/signup": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        operationId: "signup",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "username"],
                properties: {
                  email: { type: "string", format: "email", example: "user@example.com" },
                  password: { type: "string", minLength: 8, example: "MySecret123!" },
                  username: { type: "string", minLength: 3, example: "johndoe" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Account created – returns access token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token using httpOnly cookie",
        operationId: "refreshToken",
        responses: {
          200: {
            description: "New access token issued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { accessToken: { type: "string" } },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and invalidate refresh token cookie",
        operationId: "logout",
        security: bearerSecurity,
        responses: {
          200: { description: "Logged out successfully" },
          ...commonResponses,
        },
      },
    },
    "/github": {
      get: {
        tags: ["Auth"],
        summary: "Initiate GitHub OAuth flow",
        operationId: "githubOAuthStart",
        responses: {
          302: { description: "Redirect to GitHub authorization page" },
        },
      },
    },
    "/github/callback": {
      get: {
        tags: ["Auth"],
        summary: "GitHub OAuth callback – sets refresh cookie and redirects to frontend",
        operationId: "githubOAuthCallback",
        responses: {
          302: { description: "Redirect to frontend with access token" },
          ...commonResponses,
        },
      },
    },
    // ── Users ─────────────────────────────────────────────────────────────────
    "/me": {
      get: {
        tags: ["Users"],
        summary: "Get current authenticated user profile",
        operationId: "getMe",
        security: bearerSecurity,
        responses: {
          200: {
            description: "Current user profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          ...commonResponses,
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update current user profile",
        operationId: "updateMe",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string", minLength: 3 },
                  avatarUrl: { type: ["string", "null"], format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated user profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          ...commonResponses,
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete current user account",
        operationId: "deleteMe",
        security: bearerSecurity,
        responses: {
          204: { description: "Account deleted" },
          ...commonResponses,
        },
      },
    },
    "/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user by ID",
        operationId: "getUserById",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
  },
  components: {
    ...baseComponents,
  },
  security: [],
};

export default spec;
