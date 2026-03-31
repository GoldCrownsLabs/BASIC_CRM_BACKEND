const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const http = require("http");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ============ SOCKET.IO SETUP ============
// ✅ Use your existing initSocket function which creates Socket.IO and sets up handlers
const { initSocket } = require("./socket/socket");
const io = initSocket(server); // This creates Socket.IO and sets up all event handlers

// Make io available globally
global.io = io;

// ============ MIDDLEWARE ============
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============ DATABASE CONNECTION ============
const connectDB = async () => {
  try {
    console.log("🔗 Connecting to MongoDB...");

    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: "majority",
    });

    console.log("✅ MongoDB Connected");

    // Create indexes for chat collections
    const Chat = require("./models/Chat");
    try {
      await Chat.collection.createIndex({ sessionId: 1 }, { unique: true });
      await Chat.collection.createIndex({ userId: 1 });
      await Chat.collection.createIndex({ status: 1 });
      await Chat.collection.createIndex({ assignedTo: 1 });
      await Chat.collection.createIndex({ lastMessageAt: -1 });
      await Chat.collection.createIndex({ "userInfo.email": 1 });
      console.log("✅ Chat indexes created");
    } catch (error) {
      console.log("ℹ️ Chat indexes may already exist");
    }

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);

    if (process.env.NODE_ENV === "production") {
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1);
    }
  }
};

connectDB();

// ============ SWAGGER DOCS ============
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "CRM API Documentation",
  }),
);

// ============ HEALTH ROUTES ============
app.get("/", (req, res) => {
  res.json({
    message: "CRM API is Running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    features: {
      templates: "✅ Email templates with free testing",
      chat: "✅ Real-time 2-way chat support",
      whatsapp: "⏳ Coming soon",
    },
  });
});

app.get("/health", (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    socketIO: io ? "Running" : "Not Started",
    emailService: "✅ Ethereal (Testing Mode)",
    chatService: "✅ Real-time chat active",
  };

  if (mongoose.connection.readyState !== 1) {
    healthcheck.message = "Database not connected";
    return res.status(503).json({
      ...healthcheck,
      success: false,
      error: "Database connection failed",
    });
  }

  res.status(200).json({
    ...healthcheck,
    success: true,
  });
});

// ============ IMPORT ROUTES ============
const authRoutes = require("./routes/auth");
const leadRoutes = require("./routes/leads");
const taskRoutes = require("./routes/tasks");
const contactRoutes = require("./routes/contacts");
const dashboardRoutes = require("./routes/dashboard");
const activitiesRoute = require("./routes/activities");
const notificationRoutes = require("./routes/notifications");
const calendarRoutes = require("./routes/calendarRoutes");
const templateRoutes = require("./routes/templateRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const supportRoutes = require("./routes/supportRoutes");
const chatRoutes = require("./routes/chatRoutes");
const googleAuthRoutes = require("./routes/googleAuthRoutes");

// ============ USE GOOGLE AUTH ROUTES ============
app.use("/api/auth/google", googleAuthRoutes);

// ============ USE ROUTES ============
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/activities", activitiesRoute);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/chat", chatRoutes);

// ============ TEST EMAIL ROUTE ============
app.get("/test-email", async (req, res) => {
  try {
    const { sendTestEmail } = require("./utils/emailService");
    const result = await sendTestEmail();
    res.json({
      success: true,
      message: "Test email sent! Check preview URL",
      previewUrl: result.previewUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============ SOCKET.IO STATUS ROUTE ============
app.get("/socket-status", (req, res) => {
  const connectedClients = io?.engine?.clientsCount || 0;

  res.json({
    success: true,
    data: {
      socketIO: "running",
      connectedClients,
      timestamp: new Date().toISOString(),
    },
  });
});

// ============ 404 Handler ============
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      auth: "/api/auth",
      leads: "/api/leads",
      tasks: "/api/tasks",
      contacts: "/api/contacts",
      dashboard: "/api/dashboard",
      activities: "/api/activities",
      notifications: "/api/notifications",
      calendar: "/api/calendar",
      templates: "/api/templates",
      support: "/api/support",
      chat: "/api/chat",
      docs: "/api-docs",
    },
  });
});

// ============ Error Handler ============
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  const errorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  if (err.name === "ValidationError") {
    errorResponse.error = "Validation Error";
    errorResponse.details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json(errorResponse);
  }

  if (err.code === 11000) {
    errorResponse.error = "Duplicate Entry";
    errorResponse.details = `A record with this ${Object.keys(err.keyValue)[0]} already exists`;
    return res.status(400).json(errorResponse);
  }

  if (err.name === "JsonWebTokenError") {
    errorResponse.error = "Invalid Token";
    return res.status(401).json(errorResponse);
  }

  if (err.name === "TokenExpiredError") {
    errorResponse.error = "Token Expired";
    return res.status(401).json(errorResponse);
  }

  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("\n=================================");
  console.log("🚀 CRM API Server Started");
  console.log("=================================");
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🔌 Socket.IO: ws://localhost:${PORT}`);
  console.log(`💬 Chat Status: http://localhost:${PORT}/socket-status`);
  console.log(`📧 Email Templates: http://localhost:${PORT}/api/templates`);
  console.log(`✅ Email Service: Ethereal (Testing Mode)`);
  console.log(`💬 Chat Service: Real-time 2-way chat active`);
  console.log("=================================\n");
});

// ============ GRACEFUL SHUTDOWN ============
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

  if (io) {
    io.close(() => {
      console.log("✅ Socket.IO server closed");
    });
  }

  server.close(() => {
    console.log("✅ HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("❌ Forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = { app, server, io };