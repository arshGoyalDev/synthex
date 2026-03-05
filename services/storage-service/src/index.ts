import express from "express";
import cors from "cors";
import { User, ApiResponse } from "@code-ide/types";

const app = express();
const PORT = process.env.STORAGE_SERVICE_PORT || 3005;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`user-service running on port ${PORT}`);
});