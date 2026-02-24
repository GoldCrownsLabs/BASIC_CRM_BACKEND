const CalendarEvent = require("../models/CalendarEvent");

const calendarAuth = {
  // ✅ Check if event belongs to user
  checkEventOwnership: async (req, res, next) => {
    try {
      const eventId = req.params.id || req.params.eventId;

      if (!eventId) {
        return next(); // No event ID, continue
      }

      const event = await CalendarEvent.findOne({
        _id: eventId,
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found or you don't have permission",
        });
      }

      req.event = event; // Attach event to request for later use
      next();
    } catch (error) {
      console.error("Event ownership check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking event ownership",
      });
    }
  },

  // ✅ Optional: Check if user can modify event
  checkCanModify: async (req, res, next) => {
    try {
      const event = req.event || (await CalendarEvent.findById(req.params.id));

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      // Only creator or assigned user can modify
      if (
        event.createdBy.toString() !== req.user._id.toString() &&
        event.assignedTo.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to modify this event",
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

  // ✅ Validate date params
  validateDateParams: (req, res, next) => {
    const { year, month, date } = req.params;

    if (year && (isNaN(year) || year < 2000 || year > 2100)) {
      return res.status(400).json({
        success: false,
        message: "Invalid year parameter",
      });
    }

    if (month && (isNaN(month) || month < 0 || month > 11)) {
      return res.status(400).json({
        success: false,
        message: "Invalid month parameter (0-11)",
      });
    }

    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }
    }

    next();
  },
};

module.exports = calendarAuth;
