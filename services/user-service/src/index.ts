import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import openapiSpec from "./openapi";

import { env } from "./config";

import { authRoutes } from "./modules/auth/auth.routes";
import { userRoutes } from "./modules/user/user.routes";

import passport from "passport";

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;

app.use(
  cors({
    credentials: true,
    origin: env.ORIGIN,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "user-service" })});

app.get("/openapi.json", (req, res) => {
  res.json(openapiSpec);
});

app.use("/", authRoutes);
app.use("/", userRoutes);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[user-service] Error:", err.message);

    if (err.name === "ZodError") {
      const message = err.issues?.[0]?.message ?? "Validation failed";
      return res.status(400).json({ error: message });
    }

    const status = err.statusCode || err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  },
);

const server = app.listen(env.USER_SERVICE_PORT, () => {
  console.log(`user-service running on port ${env.USER_SERVICE_PORT}`);
});
