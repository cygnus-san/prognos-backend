import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import poolRoutes from "./routes/pools";

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
