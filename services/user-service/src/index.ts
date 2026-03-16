import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "./modules/auth/auth.routes";
import { env } from "./config";

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

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/", authRoutes);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Error:", err.message);

    // Zod validation errors
    if (err.name === "ZodError") {
      const message = err.issues?.[0]?.message ?? "Validation failed";
      return res.status(400).json({ error: message });
    }

    const status = err.statusCode || err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  },
);

const server = app.listen(PORT, () => {
  console.log(`user-service running on port ${PORT}`);
});
