const CalendarEvent = require("../models/CalendarEvent");

const calendarAuth = {
  // ✅ Fixed: return with response
  checkEventOwnership: async (req, res, next) => {
    try {
      const eventId = req.params.id || req.params.eventId;

      if (!eventId) {
        return next();
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

      req.event = event;
      next();
    } catch (error) {
      console.error("Event ownership check error:", error);
      return res.status(500).json({
        // ← FIXED: return added
        success: false,
        message: "Error checking event ownership",
      });
    }
  },

  // ✅ Fixed all other functions similarly
  checkCanModify: async (req, res, next) => {
    try {
      const event = req.event || (await CalendarEvent.findById(req.params.id));

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

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
      return res.status(500).json({
        // ← FIXED
        success: false,
        message: "Error checking permissions",
      });
    }
  },

  // ✅ Fixed validateDateParams
  validateDateParams: (req, res, next) => {
    try {
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
    } catch (error) {
      console.error("Date validation error:", error);
      return res.status(500).json({
        // ← FIXED
        success: false,
        message: "Error validating date parameters",
      });
    }
  },
};

module.exports = calendarAuth;
