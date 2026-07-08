import express from "express";
import cors from "cors";
import { initDb } from "./db";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

initDb();

import studentRoutes from "./routes/students";
app.use("/api/students", studentRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Alcovia API running on http://localhost:${PORT}`);
});
