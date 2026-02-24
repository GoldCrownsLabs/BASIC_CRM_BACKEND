const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  refreshToken,
  checkAdmin,
  updateLastSync,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getUsers,
  updateUser,
  deleteUser,
  getStats,
  toggleActiveStatus,
} = require("../controllers/authController");

const {
  protect,
  admin,
  checkOwnership,
  checkAddressOwnership,
  selfOrAdmin,
} = require("../middleware/auth");

// ========================
// PUBLIC ROUTES
// ========================
router.post("/register", register);
router.post("/login", login);

// ========================
// PROTECTED ROUTES (SELF)
// ========================
// Profile routes - no userId needed, automatically logged in user ka data
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.delete("/delete-profile", protect, deleteAccount);

// Address routes - with address ownership check
router.get("/addresses", protect, getAddresses);
router.post("/addresses", protect, addAddress);
router.put(
  "/addresses/:addressId",
  protect,
  checkAddressOwnership,
  updateAddress,
);
router.delete(
  "/addresses/:addressId",
  protect,
  checkAddressOwnership,
  deleteAddress,
);
router.put(
  "/addresses/:addressId/set-default",
  protect,
  checkAddressOwnership,
  setDefaultAddress,
);

// Utility routes
router.post("/logout", protect, logout);
router.post("/refresh-token", protect, refreshToken);
router.get("/check-admin", protect, checkAdmin);
router.put("/update-last-sync", protect, updateLastSync);

// ========================
// ADMIN ROUTES
// ========================
// Yeh routes sirf admin ke liye - sab users ka data access
router.get("/users", protect, admin, getUsers);
router.put("/users/:userId", protect, admin, updateUser);
router.delete("/users/:userId", protect, admin, deleteUser);
router.get("/stats", protect, admin, getStats);
router.put("/users/:userId/toggle-active", protect, admin, toggleActiveStatus);

module.exports = router;
