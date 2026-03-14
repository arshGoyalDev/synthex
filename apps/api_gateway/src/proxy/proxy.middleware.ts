import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

import { Application } from "express";

import { serviceRoutes } from "./routes";
import { authMiddleware } from "../middlewares/auth.middleware";

const registerProxies = (app: Application) => {
  for (const route of serviceRoutes) {
    const middlewares = [];

    if (route.protected) {
      middlewares.push(authMiddleware);
    }

    middlewares.push(
      createProxyMiddleware(route.path, {
        target: route.target,
        changeOrigin: true,
        pathRewrite: { [`^${route.path}`]: "" },
        selfHandleResponse: false,
        onError: (err: any, req: any, res: any) => {
          console.error(`Proxy error for ${route.path}:`, err.message);
          res.status(502).json({ error: "Service unavailable" });
        },
      }),
    );

    app.use(route.path, ...middlewares);
  }
};

export { registerProxies };
