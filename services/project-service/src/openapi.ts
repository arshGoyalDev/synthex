import type { OpenAPIObject, SchemaObject } from "openapi3-ts/oas31";
import { baseComponents, bearerSecurity, commonResponses } from "@synthex/openapi";

const ProjectSchema: SchemaObject = {
  type: "object",
  required: ["id", "name", "userId", "status"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "My Next.js App" },
    userId: { type: "string", format: "uuid" },
    description: { type: ["string", "null"] },
    language: { type: "string", example: "typescript" },
    framework: { type: ["string", "null"], example: "nextjs" },
    status: {
      type: "string",
      enum: ["idle", "starting", "ready", "stopping", "error"],
      example: "idle",
    },
    containerPort: { type: ["integer", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const spec: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Project Service",
    version: "1.0.0",
    description:
      "Manages IDE projects: lifecycle (create/start/stop/delete), environment variables, and repository import (GitHub & ZIP).",
  },
  tags: [
    { name: "Projects", description: "Project CRUD and lifecycle management" },
    { name: "Import", description: "Import projects from GitHub repos or ZIP archives" },
  ],
  paths: {
    // ── Projects ──────────────────────────────────────────────────────────────
    "/": {
      post: {
        tags: ["Projects"],
        summary: "Create a new project",
        operationId: "createProject",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "My Project" },
                  description: { type: "string" },
                  language: { type: "string", example: "typescript" },
                  framework: { type: "string", example: "nextjs" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Project created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Project" },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/me": {
      get: {
        tags: ["Projects"],
        summary: "List all projects belonging to the authenticated user",
        operationId: "getProjectsMe",
        security: bearerSecurity,
        responses: {
          200: {
            description: "Array of projects",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Project" },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Get project by ID",
        operationId: "getProjectById",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: {
            description: "Project details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } },
          },
          ...commonResponses,
        },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update project metadata",
        operationId: "updateProject",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated project",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } },
          },
          ...commonResponses,
        },
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project",
        operationId: "deleteProject",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          204: { description: "Project deleted" },
          ...commonResponses,
        },
      },
    },
    "/{id}/env": {
      get: {
        tags: ["Projects"],
        summary: "Get project environment variables",
        operationId: "getProjectEnvVars",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: {
            description: "Key-value map of env vars",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  example: { NODE_ENV: "production", PORT: "3000" },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/{id}/start": {
      post: {
        tags: ["Projects"],
        summary: "Start the project container",
        operationId: "startProject",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Container start initiated" },
          ...commonResponses,
        },
      },
    },
    "/{id}/stop": {
      post: {
        tags: ["Projects"],
        summary: "Stop the project container",
        operationId: "stopProject",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Container stop initiated" },
          ...commonResponses,
        },
      },
    },
    "/{id}/config": {
      put: {
        tags: ["Projects"],
        summary: "Update project runtime config (import-sourced)",
        operationId: "updateProjectConfig",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  language: { type: "string" },
                  framework: { type: ["string", "null"] },
                  installCommand: { type: ["string", "null"] },
                  buildCommand: { type: ["string", "null"] },
                  startCommand: { type: ["string", "null"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Config updated" },
          ...commonResponses,
        },
      },
    },
    // ── Import ────────────────────────────────────────────────────────────────
    "/import/github/repos": {
      get: {
        tags: ["Import"],
        summary: "List authenticated user's GitHub repositories",
        operationId: "listGithubRepos",
        security: bearerSecurity,
        responses: {
          200: {
            description: "List of GitHub repos",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      name: { type: "string" },
                      fullName: { type: "string" },
                      cloneUrl: { type: "string", format: "uri" },
                      private: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/import/github/detect": {
      post: {
        tags: ["Import"],
        summary: "Detect language/framework from a GitHub repo",
        operationId: "detectGithub",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["repoUrl"],
                properties: { repoUrl: { type: "string", format: "uri" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Detected project metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    language: { type: "string" },
                    framework: { type: ["string", "null"] },
                    installCommand: { type: ["string", "null"] },
                    startCommand: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/import/github": {
      post: {
        tags: ["Import"],
        summary: "Import a GitHub repo into a project",
        operationId: "importGithub",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["repoUrl", "projectId"],
                properties: {
                  repoUrl: { type: "string", format: "uri" },
                  projectId: { type: "string", format: "uuid" },
                  branch: { type: "string", default: "main" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Import started" },
          ...commonResponses,
        },
      },
    },
    "/import/zip/detect": {
      post: {
        tags: ["Import"],
        summary: "Detect language/framework from a validated ZIP manifest",
        operationId: "detectZip",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["filePaths"],
                properties: {
                  filePaths: {
                    type: "array",
                    items: { type: "string" },
                    example: ["package.json", "src/index.ts"],
                  },
                  fileContents: { type: "object", additionalProperties: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Detected metadata" },
          ...commonResponses,
        },
      },
    },
    "/import/zip": {
      post: {
        tags: ["Import"],
        summary: "Import a previously uploaded ZIP into a project",
        operationId: "importZip",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["zipKey", "name", "isPreview", "languages"],
                properties: {
                  zipKey: { type: "string" },
                  name: { type: "string", example: "my-project" },
                  description: { type: "string" },
                  runCommand: { type: "string" },
                  previewCommand: { type: "string" },
                  previewPort: { type: "integer", example: 3000 },
                  installCommand: { type: "string" },
                  isPreview: { type: "boolean", example: true },
                  languages: {
                    type: "array",
                    items: { type: "string" },
                    example: ["javascript", "typescript"],
                  },
                  envVars: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Project created and import started" },
          ...commonResponses,
        },
      },
    },
  },
  components: {
    ...baseComponents,
    schemas: {
      ...baseComponents.schemas,
      Project: ProjectSchema,
    },
  },
  security: [],
};

export default spec;
