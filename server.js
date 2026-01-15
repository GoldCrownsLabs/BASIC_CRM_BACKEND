const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const morgan = require("morgan"); // Optional: for request logging
const helmet = require("helmet"); // Optional: for security headers

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(helmet()); // Security headers
app.use(morgan("combined")); // Request logging
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= DATABASE CONNECTION =================
const connectDB = async () => {
  try {
    console.log("🔗 Attempting MongoDB connection...");

    // Check if MONGO_URI is provided
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in environment variables");
      process.exit(1);
    }

    console.log(
      "Connecting to:",
      process.env.MONGO_URI.substring(0, 50) + "..."
    );

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔁 MongoDB reconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    console.error("Error details:", {
      name: error.name,
      code: error.code,
      codeName: error.codeName,
    });

    // Retry logic (optional)
    if (process.env.NODE_ENV === "production") {
      console.log("Retrying connection in 5 seconds...");
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1);
    }
  }
};

connectDB();

// ================= SWAGGER DOCS =================
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "CRM API Documentation",
  })
);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({
    message: "CRM API is Running",
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    memory: process.memoryUsage(),
  };

  try {
    if (mongoose.connection.readyState !== 1) {
      healthcheck.message = "Database not connected";
      return res.status(503).json(healthcheck);
    }

    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    res.status(503).json(healthcheck);
  }
});

// ================= ROUTES =================
const authRoutes = require("./routes/auth");
const leadRoutes = require("./routes/leads");
const taskRoutes = require("./routes/tasks");
const contactRoutes = require("./routes/contacts");

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/contacts", contactRoutes);

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    suggestions: [
      "Check the API documentation at /api-docs",
      "Verify the endpoint URL",
      "Check the HTTP method (GET, POST, PUT, DELETE)",
    ],
  });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("🚨 Global Error Handler:", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  const errorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// ================= UNHANDLED REJECTION HANDLER =================
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
  // In production, you might want to exit and restart
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught Exception:", error);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

// ================= SERVER START =================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server Information:`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   API URL: http://localhost:${PORT}`);
  console.log(`   Docs URL: http://localhost:${PORT}/api-docs`);
  console.log(`   Health Check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log("✅ HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      console.log("👋 Shutdown complete");
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error(
      "❌ Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Export for testing (if needed)
module.exports = app;
