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

      req.contact = contact; // Attach contact to request for later use
      next();
    } catch (error) {
      console.error("Contact ownership check error:", error);

      // Check for invalid ID format
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

  // ✅ Optional: Check if user can modify contact (extra security)
  checkCanModify: async (req, res, next) => {
    try {
      const contact = req.contact || (await Contact.findById(req.params.id));

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      // Only the owner can modify
      if (contact.userId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to modify this contact",
        });
      }

      next();
    } catch (error) {
      console.error("Modify permission error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
      });
    }
  },

  // ✅ Validate contact data before passing to controller
  validateContactData: (req, res, next) => {
    const { firstName, email, phone } = req.body;

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
};

module.exports = contactAuth;
