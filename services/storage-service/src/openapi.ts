import type { OpenAPIObject } from "openapi3-ts/oas31";
import { baseComponents, bearerSecurity, commonResponses } from "@synthex/openapi";

const spec: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Storage Service",
    version: "1.0.0",
    description:
      "Manages project file storage (backed by MinIO): list, read, save, rename, delete files and snapshots. Also handles ZIP file uploads.",
  },
  tags: [
    { name: "Files", description: "Project file operations" },
    { name: "Snapshots", description: "File snapshots for history / restore" },
    { name: "Upload", description: "ZIP archive upload" },
  ],
  paths: {
    // ── Files ─────────────────────────────────────────────────────────────────
    "/{projectId}": {
      get: {
        tags: ["Files"],
        summary: "List all files in a project",
        operationId: "listFiles",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "Array of file paths",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "string", example: "src/index.ts" },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
      post: {
        tags: ["Files"],
        summary: "Save (create/overwrite) a file",
        operationId: "saveFile",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path", "content"],
                properties: {
                  path: { type: "string", example: "src/index.ts" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "File saved" },
          ...commonResponses,
        },
      },
    },
    "/{projectId}/latest-snapshot": {
      get: {
        tags: ["Snapshots"],
        summary: "Get the latest snapshot metadata for a project",
        operationId: "getLatestSnapshot",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "Snapshot metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    snapshotId: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          ...commonResponses,
        },
      },
    },
    "/{projectId}/{filePath}": {
      get: {
        tags: ["Files"],
        summary: "Get file content",
        operationId: "getFile",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "filePath", in: "path", required: true, schema: { type: "string" }, description: "Relative file path (e.g. src/index.ts)" },
        ],
        responses: {
          200: {
            description: "Raw file content",
            content: { "text/plain": { schema: { type: "string" } } },
          },
          ...commonResponses,
        },
      },
      put: {
        tags: ["Files"],
        summary: "Rename / move a file",
        operationId: "renameFile",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "filePath", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["newPath"],
                properties: { newPath: { type: "string", example: "src/renamed.ts" } },
              },
            },
          },
        },
        responses: {
          200: { description: "File renamed" },
          ...commonResponses,
        },
      },
      delete: {
        tags: ["Files"],
        summary: "Delete a file",
        operationId: "deleteFile",
        security: bearerSecurity,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "filePath", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          204: { description: "File deleted" },
          ...commonResponses,
        },
      },
    },
    // ── Upload ────────────────────────────────────────────────────────────────
    "/upload/zip": {
      post: {
        tags: ["Upload"],
        summary: "Upload a ZIP archive – returns zipKey + file manifest",
        operationId: "uploadZip",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "ZIP file (max 100 MB)",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Upload successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        zipKey: { type: "string", example: "550e8400.zip" },
                        filePaths: { type: "array", items: { type: "string" } },
                        fileContents: { type: "object", additionalProperties: { type: "string" } },
                        originalName: { type: "string" },
                      },
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
  },
  components: { ...baseComponents },
  security: [],
};

export default spec;
