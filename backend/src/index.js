import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";



import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server, allowedOrigins } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT;


// Raised from the 100kb default so base64 image payloads (stored inline in
// MongoDB) fit in the request body. Keep in sync with MAX_IMAGE_BYTES in utils.
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.get("/health", (req, res) => res.send("OK"));




server.listen(PORT,"0.0.0.0", () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
