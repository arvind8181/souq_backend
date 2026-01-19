import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.staging") });

console.log("ENV CHECK:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI ? "LOADED" : "MISSING",
});

console.log(
  "ENV FILE EXISTS:",
  fs.existsSync(path.join(__dirname, ".env.staging")),
);

console.log("RAW ENV CHECK:", {
  BUCKET_REGION: process.env.BUCKET_REGION,
  BUCKET_NAME: process.env.BUCKET_NAME,
  ACCESS_KEY: process.env.ACCESS_KEY ? "SET" : "MISSING",
  SECRET_ACCESS_KEY: process.env.SECRET_ACCESS_KEY ? "SET" : "MISSING",
});

import express, { json, urlencoded } from "express";
import cors from "cors";
import http from "http";
import db from "./db/index.js";
import router from "./routes/index.js";
import Swagger from "./swagger/index.js";
import { initializeSocket } from "./services/socket.js";
const app = express();
const PORT = process.env.PORT || 3300;

const { MongoDBConnectDB } = db;

const httpServer = http.createServer(app);
initializeSocket(httpServer);

const startServer = async () => {
  try {
    await MongoDBConnectDB();
    app.use(json({ limit: "10mb" }));
    app.use(urlencoded({ extended: true }));
    app.use(cors());
    // app.use(
    //   cors({
    //     origin: [
    //       "http://192.168.1.68:3001",
    //       "http://192.168.1.68:3000",
    //       "http://localhost:3001",
    //       "http://localhost:3000",
    //       "http://localhost:3002",
    //       "https://vendor.souqx.online",
    //       "https://admin.souqx.online",
    //       "http://localhost:8071",
    //     ],
    //     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    //     allowedHeaders: ["Content-Type", "Authorization"],
    //   })
    // );
    app.use((req, res, next) => {
      const start = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(
          `[API] ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms`,
        );
      });

      next();
    });
    

    app.use(express.static(path.join(__dirname, "public")));
    app.use("/api/v1", router);
    Swagger.swaggerRoute(app);
    app.get("/health", (req, res) => {
      res.json({ status: "OK", env: process.env.NODE_ENV });
    });
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log("**************************************");
      console.log(`Server + Socket.IO running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log("**************************************");
    });
  } catch (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
};

startServer();
