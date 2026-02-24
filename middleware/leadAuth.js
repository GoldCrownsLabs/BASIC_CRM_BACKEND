const Lead = require("../models/Lead");

const leadAuth = {
  // ✅ Check if lead exists and user has access (owner or assigned)
  checkLeadAccess: async (req, res, next) => {
    try {
      const leadId = req.params.id;

      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Lead ID is required",
        });
      }

      const lead = await Lead.findOne({
        _id: leadId,
        $or: [
          { createdBy: req.user.id }, // Owner
          { assignedTo: req.user.id }, // Assigned to
        ],
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found or you don't have permission",
        });
      }

      req.lead = lead; // Attach lead to request for later use
      next();
    } catch (error) {
      console.error("Lead access check error:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID format",
        });
      }

      res.status(500).json({
        success: false,
        message: "Error checking lead access",
      });
    }
  },

  // ✅ Strict ownership check (only creator can modify/delete)
  checkLeadOwnership: async (req, res, next) => {
    try {
      const leadId = req.params.id;

      const lead = await Lead.findOne({
        _id: leadId,
        createdBy: req.user.id, // Only owner
      });

      if (!lead) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to modify this lead",
        });
      }

      req.lead = lead;
      next();
    } catch (error) {
      console.error("Lead ownership check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking lead ownership",
      });
    }
  },

  // ✅ Check if user can view lead (owner or assigned)
  checkCanView: async (req, res, next) => {
    try {
      const leadId = req.params.id;

      const lead = await Lead.findOne({
        _id: leadId,
        $or: [{ createdBy: req.user.id }, { assignedTo: req.user.id }],
      });

      if (!lead) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this lead",
        });
      }

      req.lead = lead;
      next();
    } catch (error) {
      console.error("Lead view check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking view permission",
      });
    }
  },

  // ✅ Validate lead data before creation/update
  validateLeadData: (req, res, next) => {
    const { firstName, email, phone } = req.body;

    // For POST requests (create)
    if (req.method === "POST") {
      if (!firstName || !firstName.trim()) {
        return res.status(400).json({
          success: false,
          message: "First name is required",
        });
      }

      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }
    }

    // Email validation if provided
    if (email && email.trim()) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }
    }

    // Phone validation if provided
    if (phone && phone.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]{10,20}$/;
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid phone number",
        });
      }
    }

    // Budget validation
    if (req.body.budget !== undefined && req.body.budget < 0) {
      return res.status(400).json({
        success: false,
        message: "Budget cannot be negative",
      });
    }

    next();
  },

  // ✅ Check for duplicate email
  checkDuplicateEmail: async (req, res, next) => {
    try {
      const { email } = req.body;
      const leadId = req.params.id;

      if (!email || !email.trim()) {
        return next();
      }

      const query = {
        email: email.toLowerCase().trim(),
      };

      // If updating, exclude current lead
      if (leadId) {
        query._id = { $ne: leadId };
      }

      const existingLead = await Lead.findOne(query);

      if (existingLead) {
        return res.status(400).json({
          success: false,
          message: "Lead with this email already exists",
        });
      }

      next();
    } catch (error) {
      console.error("Duplicate email check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking duplicate email",
      });
    }
  },

  // ✅ Check if user can assign leads
  checkAssignPermission: async (req, res, next) => {
    try {
      const { assignedTo } = req.body;

      if (!assignedTo) {
        return next();
      }

      // Check if assignedTo user exists
      const User = require("../models/User");
      const user = await User.findById(assignedTo);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Assigned user does not exist",
        });
      }

      // Only managers/admins can assign to others? Optional logic
      // if (req.user.role !== 'admin' && assignedTo !== req.user.id) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "You don't have permission to assign leads to others"
      //   });
      // }

      next();
    } catch (error) {
      console.error("Assign permission check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking assign permission",
      });
    }
  },

  // ✅ Check bulk update permissions
  checkBulkUpdatePermission: async (req, res, next) => {
    try {
      const { leadIds } = req.body;

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Lead IDs are required",
        });
      }

      // Check if user owns all leads they're trying to update
      const ownedLeads = await Lead.countDocuments({
        _id: { $in: leadIds },
        createdBy: req.user.id,
      });

      if (ownedLeads !== leadIds.length) {
        return res.status(403).json({
          success: false,
          message: "You can only bulk update leads you own",
        });
      }

      next();
    } catch (error) {
      console.error("Bulk update permission error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking bulk update permissions",
      });
    }
  },
};

module.exports = leadAuth;
