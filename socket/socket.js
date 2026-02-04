// socket/socket.js
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

let io;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication error: Token required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select(
        "_id name email isActive",
      );

      if (!user || !user.isActive) {
        return next(new Error("User not found or inactive"));
      }

      socket.userId = user._id;
      socket.user = user;
      socket.join(`user-${user._id}`);

      // Join user to their department room if exists
      if (user.department) {
        socket.join(`dept-${user.department}`);
      }

      // Join role-based rooms
      socket.join(`role-${user.role}`);

      console.log(`🔌 Socket connected: ${user._id} (${user.name})`);
      next();
    } catch (error) {
      console.error("Socket auth error:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Handle notification events
    socket.on("mark-read", async (data) => {
      try {
        // Emit to user that notification was read
        socket.emit("notification-read", data);
      } catch (error) {
        console.error("Socket mark-read error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

module.exports = { initSocket, getIO };
