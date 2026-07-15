import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import client from "prom-client";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server, allowedOrigins } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT;

/* ======================================================
   Prometheus Metrics Configuration
====================================================== */

// Collect default Node.js metrics
client.collectDefaultMetrics();

// HTTP Request Counter
const httpRequests = new client.Counter({
  name: "chatapp_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
});

// HTTP Response Time Histogram
const httpDuration = new client.Histogram({
  name: "chatapp_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Middleware to collect metrics
app.use((req, res, next) => {
  const end = httpDuration.startTimer();

  res.on("finish", () => {
    httpRequests.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });

    end({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });

  next();
});

/* ======================================================
   Express Middlewares
====================================================== */

// Raised from the 100kb default so base64 image payloads
// fit in the request body.

app.use(express.json({ limit: "10mb" }));

app.use(cookieParser());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

/* ======================================================
   Routes
====================================================== */

app.use("/api/auth", authRoutes);

app.use("/api/messages", messageRoutes);

app.get("/health", (req, res) => {
  res.send("OK");
});

/* ======================================================
   Prometheus Metrics Endpoint
====================================================== */

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

/* ======================================================
   Start Server
====================================================== */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on PORT: ${PORT}`);
  connectDB();
});
