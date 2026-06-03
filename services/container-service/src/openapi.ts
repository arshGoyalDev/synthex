import type { OpenAPIObject } from "openapi3-ts/oas31";
import { baseComponents, bearerSecurity, commonResponses } from "@synthex/openapi";

const spec: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Container Service",
    version: "1.0.0",
    description:
      "Manages Docker containers for IDE projects. Exposes health checks and is the WebSocket host for interactive terminal sessions (via Socket.IO at /terminal/).",
  },
  tags: [
    { name: "Containers", description: "Container lifecycle operations" },
    { name: "Terminal", description: "Real-time WebSocket terminal (Socket.IO)" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Containers"],
        summary: "Health check",
        operationId: "containerServiceHealth",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/terminal": {
      get: {
        tags: ["Terminal"],
        summary: "WebSocket upgrade endpoint for interactive terminal (Socket.IO)",
        operationId: "terminalWebSocket",
        description:
          "Connect using Socket.IO at path `/terminal/`. Emits `terminal:data` events for output; send `terminal:input` to write to stdin. Authentication token must be passed as a Socket.IO handshake auth parameter.",
        security: bearerSecurity,
        responses: {
          101: { description: "Switching Protocols – WebSocket upgrade successful" },
          401: { description: "Unauthorized" },
        },
      },
    },
  },
  components: { ...baseComponents },
  security: [],
};

export default spec;
