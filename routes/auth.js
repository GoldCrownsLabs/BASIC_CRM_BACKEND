const express = require("express");
const router = express.Router();
const {
  // Auth controllers
  register,
  login,
  logout,
  refreshToken,
  checkAdmin,
  updateLastSync,

  // Profile controllers
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,

  // Address controllers
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,

  // Admin controllers
  getUsers,
  updateUser,
  deleteUser,
  getStats,
  toggleActiveStatus,
} = require("../controllers/authController");

const { protect, admin } = require("../middleware/auth");

// ========================
// PUBLIC ROUTES
// ========================
router.post("/register", register);
router.post("/login", login);

// ========================
// PROTECTED ROUTES
// ========================
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.delete("/delete-profile", protect, deleteAccount);

// Address routes
router.get("/addresses", protect, getAddresses);
router.post("/addresses", protect, addAddress);
router.put("/addresses/:addressId", protect, updateAddress);
router.delete("/addresses/:addressId", protect, deleteAddress);
router.put("/addresses/:addressId/set-default", protect, setDefaultAddress);

// Utility routes
router.post("/logout", protect, logout);
router.post("/refresh-token", protect, refreshToken);
router.get("/check-admin", protect, checkAdmin);
router.put("/update-last-sync", protect, updateLastSync);

// ========================
// ADMIN ROUTES
// ========================
router.get("/users", protect, admin, getUsers);
router.put("/users/:userId", protect, admin, updateUser);
router.delete("/users/:userId", protect, admin, deleteUser);
router.get("/stats", protect, admin, getStats);
router.put("/users/:userId/toggle-active", protect, admin, toggleActiveStatus);

module.exports = router;
