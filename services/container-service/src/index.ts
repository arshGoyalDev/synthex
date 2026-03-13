import express from "express";
import cors from "cors";
import { User, ApiResponse } from "@synthex/types";

const app = express();
const PORT = process.env.CONTAINER_SERVICE_PORT || 3003;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`container-service running on port ${PORT}`);
});