import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import poolRoutes from "./routes/pools";
import { PoolResolutionService } from "./services/poolResolutionService";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/pools", poolRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Prognos MVP Backend API" });
});

// Add health check endpoint that includes service status
app.get("/api/health", (req, res) => {
  const poolResolutionStatus = PoolResolutionService.getStatus();
  res.json({
    message: "Prognos MVP Backend API",
    timestamp: new Date().toISOString(),
    services: {
      poolResolution: poolResolutionStatus
    }
  });
});

// Add manual trigger endpoint for testing
app.post("/api/admin/resolve-expired", async (req, res) => {
  try {
    await PoolResolutionService.checkNow();
    res.json({ message: "Manual pool resolution check triggered" });
  } catch (error) {
    console.error("Error triggering manual resolution:", error);
    res.status(500).json({ error: "Failed to trigger manual resolution" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the automatic pool resolution service
  PoolResolutionService.start();
});

process.on("beforeExit", async () => {
  PoolResolutionService.stop();
  await prisma.$disconnect();
});
