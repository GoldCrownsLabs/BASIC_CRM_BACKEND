const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const { protect } = require("../middleware/auth");
const leadAuth = require("../middleware/leadAuth"); // ✅ Import karo

// Apply auth middleware to all routes
router.use(protect);

// ======== PUBLIC/COLLECTION ROUTES (no ID) ========

// @route   POST /api/leads
// @desc    Create new lead
// @access  Private
// ✅ Added validation + duplicate check
router.post(
  "/",
  leadAuth.validateLeadData,
  leadAuth.checkDuplicateEmail,
  leadAuth.checkAssignPermission,
  leadController.createLead,
);

// @route   GET /api/leads
// @desc    Get all leads with pagination
// @access  Private
// ✅ Controller already has proper filters
router.get("/", leadController.getLeads);

// @route   GET /api/leads/assigned/me
// @desc    Get leads assigned to current user
// @access  Private
router.get("/assigned/me", leadController.getMyLeads);

// @route   GET /api/leads/summary/stats
// @desc    Get lead statistics
// @access  Private
router.get("/summary/stats", leadController.getLeadStats);

// @route   PUT /api/leads/bulk-update
// @desc    Bulk update leads
// @access  Private
// ✅ Added ownership check for bulk update
router.put(
  "/bulk-update",
  leadAuth.checkBulkUpdatePermission,
  leadController.bulkUpdateLeads,
);

// ======== INDIVIDUAL LEAD ROUTES (with ID) ========

// @route   GET /api/leads/:id
// @desc    Get single lead by ID
// @access  Private
// ✅ Added access check (owner or assigned)
router.get("/:id", leadAuth.checkLeadAccess, leadController.getLeadById);

// @route   PUT /api/leads/:id
// @desc    Update lead
// @access  Private
// ✅ Added strict ownership check
router.put(
  "/:id",
  leadAuth.checkLeadOwnership,
  leadAuth.validateLeadData,
  leadAuth.checkDuplicateEmail,
  leadAuth.checkAssignPermission,
  leadController.updateLead,
);

// @route   DELETE /api/leads/:id
// @desc    Delete lead
// @access  Private
// ✅ Added strict ownership check
router.delete("/:id", leadAuth.checkLeadOwnership, leadController.deleteLead);

// @route   POST /api/leads/:id/notes
// @desc    Add note to lead
// @access  Private
// ✅ Added access check (can add note if you have access)
router.post("/:id/notes", leadAuth.checkLeadAccess, leadController.addNote);

// @route   PATCH /api/leads/:id/status
// @desc    Update lead status
// @access  Private
// ✅ Added access check (can update status if you have access)
router.patch(
  "/:id/status",
  leadAuth.checkLeadAccess,
  leadController.updateLeadStatus,
);

module.exports = router;
