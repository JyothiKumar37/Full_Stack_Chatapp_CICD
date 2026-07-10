import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

// CORS origin config shared by both the Express REST API (index.js) and the
// Socket.io server below, so realtime and HTTP CORS never drift apart.
//
// CORS_ORIGINS env var:
//   unset or "*"  -> reflect the request's own origin (allows any host; handy
//                    when the app is served same-origin behind nginx and the
//                    public IP/host changes, e.g. a non-Elastic EC2 IP).
//   "a,b,c"       -> allow only this explicit comma-separated list.
// `true` here means the cors library echoes back the incoming Origin header,
// which works with credentials (unlike the wildcard "*").
export const allowedOrigins =
  !process.env.CORS_ORIGINS || process.env.CORS_ORIGINS.trim() === "*"
    ? true
    : process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
