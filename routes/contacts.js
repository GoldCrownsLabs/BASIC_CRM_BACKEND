const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
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

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      errors: errors.array(),
      message: "Validation failed",
    });
  };
};

// Contact creation validation
const createContactValidation = [
  check("firstName", "First name is required and must be at least 2 characters")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .isLength({ min: 2 }),
  check("lastName", "Last name must be a string").optional().trim().escape(),
  check("email", "Please include a valid email")
    .optional()
    .isEmail()
    .normalizeEmail(),
  check("phone", "Phone number must be valid").optional().isMobilePhone(),
  check("company", "Company must be a string").optional().trim().escape(),
  check("jobTitle", "Job title must be a string").optional().trim().escape(),
  check("tags", "Tags must be an array of strings").optional().isArray(),
  check("tags.*", "Each tag must be a string").optional().trim().escape(),
  check("notes", "Notes cannot exceed 2000 characters")
    .optional()
    .isLength({ max: 2000 })
    .trim()
    .escape(),
];

// Contact update validation
const updateContactValidation = [
  check("firstName", "First name must be a string")
    .optional()
    .not()
    .isEmpty()
    .trim()
    .escape(),
  check("email", "Please include a valid email")
    .optional()
    .isEmail()
    .normalizeEmail(),
  check("phone", "Phone number must be valid").optional().isMobilePhone(),
];

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
router.post("/", protect, validate(createContactValidation), createContact);

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Private
router.put("/:id", protect, validate(updateContactValidation), updateContact);

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

// @route   GET /api/contacts/export
// @desc    Export contacts as CSV
// @access  Private
router.get("/export", protect, exportContacts);

// @route   GET /api/contacts/companies
// @desc    Get unique companies for autocomplete
// @access  Private
router.get("/companies", protect, getCompanies);

// @route   GET /api/contacts/tags
// @desc    Get unique tags for autocomplete
// @access  Private
router.get("/tags", protect, getTags);

module.exports = router;
