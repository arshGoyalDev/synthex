import { createProxyMiddleware, RequestHandler } from "http-proxy-middleware";
import { Application } from "express";
import { Server as HttpServer } from "http";

const previewProxies = new Map<string, RequestHandler>();
let expressApp: Application;
let httpServer: HttpServer;

export function initPreviewProxy(app: Application, server: HttpServer) {
  expressApp = app;
  httpServer = server;
}

export function registerPreviewProxy(projectId: string, target: string) {
  if (previewProxies.has(projectId)) {
    console.log(`[preview-proxy] Updating proxy for ${projectId} → ${target}`);
  } else {
    console.log(`[preview-proxy] Registering proxy for ${projectId} → ${target}`);
  }

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,              // ← critical for Vite HMR WebSocket
    pathRewrite: (path) => {
      // strip /preview/{projectId} prefix
      return path.replace(`/preview/${projectId}`, "") || "/";
    },
    on: {
      error: (err, req, res: any) => {
        console.error(`[preview-proxy] Error for ${projectId}:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: "Preview unavailable" });
        }
      },
      proxyReqWs: (proxyReq, req, socket, options, head) => {
        // forward WebSocket for HMR
        console.log(`[preview-proxy] WS upgrade for ${projectId}`);
      },
    },
  });

  previewProxies.set(projectId, proxy);

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith(`/preview/${projectId}`)) {
      (proxy as any).upgrade(req, socket, head);
    }
  });
}

export function removePreviewProxy(projectId: string) {
  previewProxies.delete(projectId);
  console.log(`[preview-proxy] Removed proxy for ${projectId}`);
}

export function getPreviewProxy(projectId: string): RequestHandler | undefined {
  return previewProxies.get(projectId);
}