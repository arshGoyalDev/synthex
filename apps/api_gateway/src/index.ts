import express from "express";
import cors from "cors";
import { User, ApiResponse } from "@synthex/types";

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`api-gateway running on port ${PORT}`);
});