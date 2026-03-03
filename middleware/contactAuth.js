const Contact = require("../models/Contact");

const contactAuth = {
  // ✅ Check if contact exists and belongs to user
  checkContactOwnership: async (req, res, next) => {
    try {
      const contactId = req.params.id;

      if (!contactId) {
        return res.status(400).json({
          success: false,
          message: "Contact ID is required",
        });
      }

      const contact = await Contact.findOne({
        _id: contactId,
        userId: req.user.id,
        isDeleted: false,
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found or you don't have permission",
        });
      }

      req.contact = contact; // Attach contact to request
      next();
    } catch (error) {
      console.error("Contact ownership check error:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid contact ID format",
        });
      }

      res.status(500).json({
        success: false,
        message: "Error checking contact ownership",
      });
    }
  },

  // ✅ Validate contact data (updated with new fields)
  validateContactData: (req, res, next) => {
    const { firstName, email, phone, connected, completed, dealValue } =
      req.body;

    // Basic validation
    if (req.method === "POST" && (!firstName || !firstName.trim())) {
      return res.status(400).json({
        success: false,
        message: "First name is required",
      });
    }

    // Email validation if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
          message: "Please provide a valid phone number (10-20 digits)",
        });
      }
    }

    // Validate connected field
    if (connected !== undefined && typeof connected !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Connected field must be a boolean value",
      });
    }

    // Validate completed field
    if (completed !== undefined && typeof completed !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Completed field must be a boolean value",
      });
    }

    // Validate deal value (if completed is true)
    if (completed === true || req.body.completed === true) {
      if (!dealValue || dealValue <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Deal value is required and must be greater than 0 for completed deals",
        });
      }

      if (isNaN(dealValue)) {
        return res.status(400).json({
          success: false,
          message: "Deal value must be a number",
        });
      }
    }

    // Validate lead status if provided
    if (req.body.leadStatus) {
      const validStatuses = ["cold", "warm", "hot", "connected", "completed"];
      if (!validStatuses.includes(req.body.leadStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid lead status. Must be one of: " + validStatuses.join(", "),
        });
      }
    }

    next();
  },

  // ✅ Check for duplicate email
  checkDuplicateEmail: async (req, res, next) => {
    try {
      const { email } = req.body;
      const contactId = req.params.id;

      if (!email || !email.trim()) {
        return next();
      }

      const query = {
        userId: req.user.id,
        email: email.toLowerCase().trim(),
        isDeleted: false,
      };

      // If updating, exclude current contact
      if (contactId) {
        query._id = { $ne: contactId };
      }

      const existingContact = await Contact.findOne(query);

      if (existingContact) {
        return res.status(400).json({
          success: false,
          message: "Contact with this email already exists",
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

  // ✅ Check if user can modify deal (additional security)
  checkDealPermissions: (req, res, next) => {
    const { completed, dealValue } = req.body;

    // Only allow deal value modification if user has permission
    // You can add role-based checks here

    // Example: Only managers can set deal values above certain amount
    if (dealValue && dealValue > 100000 && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to set deals above 100,000",
      });
    }

    next();
  },
};

module.exports = contactAuth;
