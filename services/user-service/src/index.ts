import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`user-service running on port ${PORT}`);
});