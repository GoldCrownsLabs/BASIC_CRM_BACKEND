const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const contactAuth = require("../middleware/contactAuth"); // ✅ Import karo
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
  getCompanies,
  getTags,
} = require("../controllers/contactController");

// ================= ROUTES =================

// @route   GET /api/contacts
// @desc    Get all contacts with pagination and filters
// @access  Private
// ✅ Controller already has userId filter
router.get("/", protect, getContacts);

// @route   GET /api/contacts/stats/count
// @desc    Get contact statistics
// @access  Private
// ✅ Controller already has userId filter
router.get("/stats/count", protect, getContactStats);

// @route   GET /api/contacts/stats/tags
// @desc    Get tag statistics
// @access  Private
// ✅ Controller already has userId filter
router.get("/stats/tags", protect, getTagStats);

// @route   POST /api/contacts/batch
// @desc    Batch sync contacts
// @access  Private
// ✅ Controller assigns userId
router.post("/batch", protect, batchSyncContacts);

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Private
// ✅ Controller assigns userId, added validation middleware
router.post(
  "/",
  protect,
  contactAuth.validateContactData,
  contactAuth.checkDuplicateEmail,
  createContact,
);

// ======== INDIVIDUAL CONTACT ROUTES (NEED OWNERSHIP CHECK) ========

// @route   GET /api/contacts/:id
// @desc    Get single contact by ID
// @access  Private
// ✅ ADDED ownership check
router.get("/:id", protect, contactAuth.checkContactOwnership, getContactById);

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Private
// ✅ ADDED ownership check + validation
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
// ✅ ADDED ownership check
router.patch(
  "/:id/favorite",
  protect,
  contactAuth.checkContactOwnership,
  toggleFavorite,
);

// @route   DELETE /api/contacts/:id
// @desc    Soft delete contact
// @access  Private
// ✅ ADDED ownership check
router.delete(
  "/:id",
  protect,
  contactAuth.checkContactOwnership,
  deleteContact,
);

module.exports = router;
