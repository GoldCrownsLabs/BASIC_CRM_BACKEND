const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const contactAuth = require("../middleware/contactAuth");
const {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  toggleFavorite,
  deleteContact,
  getContactStats,
  getTagStats,
  batchSyncContacts,
  markAsConnected, // ✅ New
  markAsCompleted, // ✅ New
  getUserPerformance, // ✅ New
} = require("../controllers/contactController");

// ================= ROUTES =================

// @route   GET /api/contacts
// @desc    Get all contacts with filters
// @access  Private
router.get("/", protect, getContacts);

// @route   GET /api/contacts/stats/count
// @desc    Get contact statistics (updated with performance)
// @access  Private
router.get("/stats/count", protect, getContactStats);

// @route   GET /api/contacts/stats/tags
// @desc    Get tag statistics (updated with connected/completed)
// @access  Private
router.get("/stats/tags", protect, getTagStats);

// @route   GET /api/contacts/performance
// @desc    Get user performance report
// @access  Private (Admin can see others)
router.get("/performance", protect, getUserPerformance);

// @route   POST /api/contacts/batch
// @desc    Batch sync contacts
// @access  Private
router.post("/batch", protect, batchSyncContacts);

// @route   POST /api/contacts
// @desc    Create new contact (with all fields)
// @access  Private
router.post(
  "/",
  protect,
  contactAuth.validateContactData,
  contactAuth.checkDuplicateEmail,
  createContact,
);

// ======== INDIVIDUAL CONTACT ROUTES ========

// @route   GET /api/contacts/:id
// @desc    Get single contact by ID
// @access  Private
router.get("/:id", protect, contactAuth.checkContactOwnership, getContactById);

// @route   PUT /api/contacts/:id
// @desc    Update contact (with all fields)
// @access  Private
router.put(
  "/:id",
  protect,
  contactAuth.checkContactOwnership,
  contactAuth.validateContactData,
  contactAuth.checkDuplicateEmail,
  updateContact,
);

// @route   PATCH /api/contacts/:id/favorite
// @desc    Toggle favorite status
// @access  Private
router.patch(
  "/:id/favorite",
  protect,
  contactAuth.checkContactOwnership,
  toggleFavorite,
);

// @route   PATCH /api/contacts/:id/connected
// @desc    Mark contact as connected
// @access  Private
router.patch(
  "/:id/connected",
  protect,
  contactAuth.checkContactOwnership,
  markAsConnected,
);

// @route   PATCH /api/contacts/:id/completed
// @desc    Mark contact as completed (with deal value)
// @access  Private
router.patch(
  "/:id/completed",
  protect,
  contactAuth.checkContactOwnership,
  markAsCompleted,
);

// @route   DELETE /api/contacts/:id
// @desc    Soft delete contact
// @access  Private
router.delete(
  "/:id",
  protect,
  contactAuth.checkContactOwnership,
  deleteContact,
);

module.exports = router;
