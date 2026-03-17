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

const { initSocket } = require("./socket/socket");
const io = initSocket(server);
global.io = io;

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

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "CRM API Documentation",
  }),
);

app.get("/", (req, res) => {
  res.json({
    message: "CRM API is Running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    features: {
      templates: "✅ Email templates with free testing",
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
    emailService: "✅ Ethereal (Testing Mode)",
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
const templateRoutes = require("./routes/templateRoutes"); // ✅ NEW: Template routes
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

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

// ============ TEST EMAIL ROUTE (Quick test) ============
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🔌 Socket.IO: ws://localhost:${PORT}`);
  console.log(`📧 Email Templates: http://localhost:${PORT}/api/templates`);
  console.log(`📧 Test Email: http://localhost:${PORT}/test-email`);
  console.log(`✅ Email Service: Ethereal (Testing Mode - Free)`);
});

const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

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