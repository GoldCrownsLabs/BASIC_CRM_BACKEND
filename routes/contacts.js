const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
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
  exportContacts,
  getCompanies,
  getTags,
} = require("../controllers/contactController");

// ================= ROUTES =================

// @route   GET /api/contacts
// @desc    Get all contacts with pagination and filters
// @access  Private
router.get("/", protect, getContacts);

// @route   GET /api/contacts/:id
// @desc    Get single contact by ID
// @access  Private
router.get("/:id", protect, getContactById);

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Private
router.post("/", protect, createContact); // ✅ Validation removed

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Private
router.put("/:id", protect, updateContact); // ✅ Validation removed

// @route   PATCH /api/contacts/:id/favorite
// @desc    Toggle favorite status
// @access  Private
router.patch("/:id/favorite", protect, toggleFavorite);

// @route   DELETE /api/contacts/:id
// @desc    Soft delete contact
// @access  Private
router.delete("/:id", protect, deleteContact);

// @route   GET /api/contacts/stats/count
// @desc    Get contact statistics
// @access  Private
router.get("/stats/count", protect, getContactStats);

// @route   GET /api/contacts/stats/tags
// @desc    Get tag statistics
// @access  Private
router.get("/stats/tags", protect, getTagStats);

// @route   POST /api/contacts/batch
// @desc    Batch sync contacts
// @access  Private
router.post("/batch", protect, batchSyncContacts);



module.exports = router;
