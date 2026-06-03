import type { OpenAPIObject, SchemaObject } from "openapi3-ts/oas31";
import { baseComponents, bearerSecurity, commonResponses } from "@synthex/openapi";

const ExecutionSchema: SchemaObject = {
  type: "object",
  required: ["id", "projectId", "status"],
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: { type: "string", format: "uuid" },
    status: {
      type: "string",
      enum: ["pending", "running", "completed", "failed", "killed"],
    },
    exitCode: { type: ["integer", "null"] },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: ["string", "null"], format: "date-time" },
  },
};

const spec: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Execution Service",
    version: "1.0.0",
    description:
      "Runs code and commands inside project containers. Manages execution lifecycle, streaming output buffers, and preview (dev-server) processes.",
  },
  tags: [
    { name: "Executions", description: "Code execution CRUD and history" },
    { name: "Preview", description: "Dev-server preview start/stop" },
  ],
  paths: {
    // ── Executions ────────────────────────────────────────────────────────────
    "/": {
      post: {
        tags: ["Executions"],
        summary: "Start a new code execution",
        operationId: "startExecution",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectId", "command"],
                properties: {
                  projectId: { type: "string", format: "uuid" },
                  command: { type: "string", example: "npm run build" },
                  env: { type: "object", additionalProperties: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Execution started",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Execution" },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/{executionId}": {
      get: {
        tags: ["Executions"],
        summary: "Get execution status and metadata",
        operationId: "getExecution",
        security: bearerSecurity,
        parameters: [
          { name: "executionId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "Execution details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Execution" },
              },
            },
          },
          ...commonResponses,
        },
      },
      delete: {
        tags: ["Executions"],
        summary: "Kill / abort a running execution",
        operationId: "killExecution",
        security: bearerSecurity,
        parameters: [
          { name: "executionId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Execution killed" },
          ...commonResponses,
        },
      },
    },
    "/{executionId}/buffer": {
      get: {
        tags: ["Executions"],
        summary: "Get buffered stdout/stderr output for an execution",
        operationId: "getBuffer",
        security: bearerSecurity,
        parameters: [
          { name: "executionId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "Output buffer",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    stdout: { type: "string" },
                    stderr: { type: "string" },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/project/{projectId}": {
      get: {
        tags: ["Executions"],
        summary: "Get execution history for a project",
        operationId: "getHistory",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "List of past executions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Execution" },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    // ── Preview ───────────────────────────────────────────────────────────────
    "/preview": {
      post: {
        tags: ["Preview"],
        summary: "Start a dev-server preview process",
        operationId: "startPreview",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectId"],
                properties: {
                  projectId: { type: "string", format: "uuid" },
                  command: { type: "string", example: "npm run dev" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Preview started",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    port: { type: "integer", example: 3000 },
                    url: { type: "string", format: "uri" },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/preview/{projectId}": {
      delete: {
        tags: ["Preview"],
        summary: "Stop the preview process for a project",
        operationId: "stopPreview",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Preview stopped" },
          ...commonResponses,
        },
      },
    },
  },
  components: {
    ...baseComponents,
    schemas: {
      ...baseComponents.schemas,
      Execution: ExecutionSchema,
    },
  },
  security: [],
};

export default spec;
