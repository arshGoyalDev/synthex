import type { SchemaObject, ReferenceObject } from "openapi3-ts/oas31";

// ─── Reusable Schema Objects ──────────────────────────────────────────────────

export const ErrorResponseSchema: SchemaObject = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "string",
      description: "Human-readable error message",
      example: "Resource not found",
    },
  },
};

export const PaginationSchema: SchemaObject = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, example: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, example: 20 },
    total: { type: "integer", example: 42 },
    hasMore: { type: "boolean", example: false },
  },
};

export const TimestampSchema: SchemaObject = {
  type: "string",
  format: "date-time",
  example: "2024-01-01T00:00:00.000Z",
};

export const UuidSchema: SchemaObject = {
  type: "string",
  format: "uuid",
  example: "550e8400-e29b-41d4-a716-446655440000",
};

export const UserSchema: SchemaObject = {
  type: "object",
  required: ["id", "email", "username"],
  properties: {
    id: UuidSchema,
    email: { type: "string", format: "email", example: "user@example.com" },
    username: { type: "string", example: "johndoe" },
    avatarUrl: { type: "string", format: "uri" },
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  },
};

// ─── Common Responses ─────────────────────────────────────────────────────────

export const commonResponses = {
  400: {
    description: "Bad Request – validation failed",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
    },
  },
  401: {
    description: "Unauthorized – missing or invalid JWT",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
    },
  },
  403: {
    description: "Forbidden – insufficient permissions",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
    },
  },
  404: {
    description: "Not Found",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
    },
  },
  500: {
    description: "Internal Server Error",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
    },
  },
} as const;

// ─── Base Components Object ───────────────────────────────────────────────────

export const baseComponents = {
  schemas: {
    ErrorResponse: ErrorResponseSchema,
    Pagination: PaginationSchema,
    User: UserSchema,
  },
  securitySchemes: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT access token issued by the auth service",
    },
  },
} as const;

// ─── Base OpenAPI Config ──────────────────────────────────────────────────────

export const baseOpenApiConfig = {
  openapi: "3.1.0",
  info: {
    contact: {
      name: "Synthex Engineering",
      url: "https://github.com/your-org/synthex",
    },
    license: {
      name: "MIT",
    },
  },
  servers: [] as Array<{ url: string; description?: string }>,
} as const;

// ─── Security Requirement (for protected routes) ──────────────────────────────

export const bearerSecurity = [{ BearerAuth: [] }];

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { SchemaObject, ReferenceObject };
