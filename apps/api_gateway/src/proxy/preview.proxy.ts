import { createProxyMiddleware, RequestHandler } from "http-proxy-middleware";
import { Application, Request, Response, NextFunction } from "express";
import { Server as HttpServer } from "http";
import { redis } from "../config/database";

type PreviewProxy = RequestHandler & {
  upgrade?: (req: any, socket: any, head: any) => void;
};

const previewProxies = new Map<string, PreviewProxy>();
let httpServer: HttpServer;
let upgradeHandlerRegistered = false;

export function initPreviewProxy(app: Application, server: HttpServer) {
  httpServer = server;

  app.use(
    "/preview/:projectId",
    (req: Request, res: Response, next: NextFunction) => {
      void handlePreviewRequest(req, res, next);
    },
  );

  if (!upgradeHandlerRegistered) {
    httpServer.on("upgrade", async (req, socket, head) => {
      const projectId = getProjectIdFromUrl(req.url);
      if (!projectId) return;

      const canAccess = await validatePreviewUpgrade(req, projectId);
      if (!canAccess) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const proxy = await ensurePreviewProxy(projectId);
      if (!proxy?.upgrade) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      stripPreviewTokenFromIncomingMessage(req);
      proxy.upgrade(req, socket, head);
    });
    upgradeHandlerRegistered = true;
  }

  async function handlePreviewRequest(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({ error: "No projectId provided" });
      }

      const canAccess = await validatePreviewAccess(req, res, projectId);
      if (!canAccess) {
        return res.status(403).json({ error: "Preview access denied" });
      }

      const proxy = await ensurePreviewProxy(projectId);

      if (!proxy) {
        return res.status(404).json({ error: "Preview not found" });
      }

      stripPreviewToken(req);
      proxy(req, res, next);
    } catch (err) {
      next(err);
    }
  }
}

export function registerPreviewProxy(projectId: string, target: string) {
  if (previewProxies.has(projectId)) {
    console.log(`[preview-proxy] Updating proxy for ${projectId} → ${target}`);
  } else {
    console.log(
      `[preview-proxy] Registering proxy for ${projectId} → ${target}`,
    );
  }

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true, // ← critical for Vite HMR WebSocket
    pathRewrite: (path) => {
      // strip /preview/{projectId} prefix
      return path.replace(`/preview/${projectId}`, "") || "/";
    },
    onError: (err: any, _req: any, res: any) => {
      console.error(`[preview-proxy] Error for ${projectId}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Preview unavailable" });
      }
    },
    onProxyReqWs: () => {
      console.log(`[preview-proxy] WS upgrade for ${projectId}`);
    },
  }) as PreviewProxy;

  previewProxies.set(projectId, proxy);
}

export function removePreviewProxy(projectId: string) {
  previewProxies.delete(projectId);
  console.log(`[preview-proxy] Removed proxy for ${projectId}`);
}

export function getPreviewProxy(projectId: string): RequestHandler | undefined {
  return previewProxies.get(projectId);
}

export async function restorePreviewProxies() {
  const keys = await redis.keys("preview:*:target");

  for (const key of keys) {
    const match = key.match(/^preview:(.+):target$/);
    if (!match?.[1]) continue;

    const target = await redis.get(key);
    const status = await redis.get(`preview:${match[1]}:status`);
    if (target && status === "running") {
      registerPreviewProxy(match[1], target);
    }
  }
}

async function ensurePreviewProxy(projectId: string) {
  const existing = previewProxies.get(projectId);
  if (existing) return existing;

  const status = await redis.get(`preview:${projectId}:status`);
  const target = await redis.get(`preview:${projectId}:target`);
  if (status !== "running" || !target) return undefined;

  registerPreviewProxy(projectId, target);
  return previewProxies.get(projectId);
}

async function validatePreviewAccess(
  req: Request,
  res: Response,
  projectId: string,
) {
  const token =
    getPreviewToken(req.originalUrl) ??
    getCookie(req.headers.cookie, previewCookieName(projectId));
  const expectedToken = await redis.get(`preview:${projectId}:token`);
  if (!token || !expectedToken || token !== expectedToken) return false;

  res.cookie(previewCookieName(projectId), expectedToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    path: `/preview/${projectId}`,
  });

  return true;
}

async function validatePreviewUpgrade(req: any, projectId: string) {
  const token =
    getPreviewToken(req.url ?? "") ??
    getCookie(req.headers?.cookie, previewCookieName(projectId));
  const expectedToken = await redis.get(`preview:${projectId}:token`);
  return !!token && !!expectedToken && token === expectedToken;
}

function getProjectIdFromUrl(url: string | undefined) {
  if (!url?.startsWith("/preview/")) return null;
  return url.split("/")[2] || null;
}

function getPreviewToken(url: string) {
  try {
    return new URL(url, "http://preview.local").searchParams.get(
      "previewToken",
    );
  } catch {
    return null;
  }
}

function getCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function previewCookieName(projectId: string) {
  return `synthex_preview_${projectId}`;
}

function stripPreviewToken(req: Request) {
  req.url = stripPreviewTokenFromUrl(req.url);
}

function stripPreviewTokenFromIncomingMessage(req: any) {
  req.url = stripPreviewTokenFromUrl(req.url ?? "");
}

function stripPreviewTokenFromUrl(url: string) {
  const parsed = new URL(url, "http://preview.local");
  parsed.searchParams.delete("previewToken");
  return `${parsed.pathname}${parsed.search}`;
}
