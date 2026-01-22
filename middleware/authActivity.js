const jwt = require("jsonwebtoken");
const mongoose = require("mongoose"); // ✅ ADD THIS
const Activity = require("../models/Activity");
const User = require("../models/User");
const Contact = require("../models/Contact");
const Lead = require("../models/Lead");

const authActivity = {
  // ✅ PROTECT METHOD (जो routes/activities.js में use हो रहा है)
  protect: async (req, res, next) => {
    try {
      let token;

      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
      ) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Not authorized. No token provided.",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
        error: error.message,
      });
    }
  },

  // ... बाकी methods वही रहेंगे जो आपके पास हैं
  checkActivityOwnership: async (req, res, next) => {
    try {
      const activity = await Activity.findById(req.params.id);

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      if (activity.userId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this activity",
        });
      }

      req.activity = activity;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  validateActivityData: (req, res, next) => {
    const { type, title, date } = req.body;

    if (!type || !title || !date) {
      return res.status(400).json({
        success: false,
        message: "Type, title, and date are required",
      });
    }

    const validTypes = ["call", "meeting", "email", "note", "task", "other"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity type",
      });
    }

    const activityDate = new Date(date);
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    if (req.body.duration !== undefined && req.body.duration < 0) {
      return res.status(400).json({
        success: false,
        message: "Duration must be a positive number",
      });
    }

    next();
  },

  checkRelatedEntities: async (req, res, next) => {
    try {
      const { contactId, leadId } = req.body;

      if (contactId) {
        const contact = await Contact.findOne({
          _id: contactId,
          userId: req.user.id,
        });
        if (!contact) {
          return res.status(404).json({
            success: false,
            message: "Contact not found or not accessible",
          });
        }
      }

      if (leadId) {
        const lead = await Lead.findOne({
          _id: leadId,
          userId: req.user.id,
        });
        if (!lead) {
          return res.status(404).json({
            success: false,
            message: "Lead not found or not accessible",
          });
        }
      }

      if (contactId && leadId) {
        return res.status(400).json({
          success: false,
          message: "Activity can be linked to either contact or lead, not both",
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },
};

module.exports = authActivity;
