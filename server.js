const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

dotenv.config();
const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= DATABASE =================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Error:', error.message);
    process.exit(1);
  }
};
connectDB();

// ================= SWAGGER =================
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ================= ROUTES =================
app.get('/', (req, res) => {
  res.json({ message: 'CRM API Running', status: 'OK' });
});

// Auth & Leads
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📘 Swagger Docs: http://localhost:${PORT}/api-docs`);
});
