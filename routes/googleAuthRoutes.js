const express = require("express");
const router = express.Router();
const {
  googleLogin,
  getGoogleAuthInfo,
  unlinkGoogleAccount,
  refreshGoogleToken,
} = require("../controllers/googleAuthController");
const { protect } = require("../middleware/auth");

// ========================
// GOOGLE AUTH ROUTES
// ========================

// Public routes
router.post("/login", googleLogin);

// Protected routes (require authentication)
router.get("/info", protect, getGoogleAuthInfo);
router.delete("/unlink", protect, unlinkGoogleAccount);
router.post("/refresh-token", protect, refreshGoogleToken);

module.exports = router;


