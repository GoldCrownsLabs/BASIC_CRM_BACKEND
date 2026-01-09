const express = require("express");
const router = express.Router(); // ✅ ये line जरूरी है!
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); // ✅ bcrypt import करें
const User = require("../models/User");

// JWT Token generate function with fallback
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET ||
      "dev_secret_key_for_testing_only_change_in_production",
    { expiresIn: "30d" }
  );
};

// @route   POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide all fields: name, email, password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    console.log("Checking if user exists...");
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log("User already exists:", email);
      return res.status(400).json({
        success: false,
        error: "User already exists",
      });
    }

    console.log("Hashing password manually...");
    // Manual password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log("Creating user...");
    const user = await User.create({
      name,
      email,
      password: hashedPassword, // Use hashed password directly
    });

    console.log("✅ User created:", user.email);

    const token = generateToken(user._id);
    console.log("✅ Token generated");

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("🔥 REGISTRATION ERROR:", error);

    // Specific error handling
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      error: "Registration failed. Please try again.",
    });
  }
});

// @route   POST /api/auth/login
router.post("/login", async (req, res) => {
  console.log("=== LOGIN API CALLED ===");
  console.log("Body:", req.body);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide email and password",
      });
    }

    console.log("Finding user...");
    const user = await User.findOne({ email });

    if (!user) {
      console.log("User not found:", email);
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    console.log("Comparing password...");
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const token = generateToken(user._id);
    console.log("✅ Login successful:", user.email);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("🔥 LOGIN ERROR:", error);
    res.status(500).json({
      success: false,
      error: "Login failed. Please try again.",
    });
  }
});

// Test route for debugging
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth API is working",
    timestamp: new Date(),
    jwtSecret: process.env.JWT_SECRET ? "Set" : "Not Set",
  });
});

module.exports = router;
