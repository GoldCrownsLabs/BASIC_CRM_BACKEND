const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const Contact = require("../models/Contact");
const Lead = require("../models/Lead");

// Helper function to convert 12h to 24h format
const convertTo24Hour = (time12h) => {
  if (!time12h) return "00:00";

  const timeStr = time12h.trim().toUpperCase();

  // Handle formats like "2:30 PM", "02:30 PM", "2:30PM"
  let time = timeStr;
  let modifier = "AM";

  // Check if contains AM/PM
  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    const parts = timeStr.split(/(AM|PM)/);
    time = parts[0].trim();
    modifier = parts[1];
  }

  // Handle different time formats
  let [hours, minutes = "00"] = time.split(":");

  // Clean up hours
  hours = hours.replace(/\D/g, "");
  hours = parseInt(hours, 10);

  // Convert to 24-hour format
  if (modifier === "PM" && hours < 12) {
    hours += 12;
  } else if (modifier === "AM" && hours === 12) {
    hours = 0;
  }

  // Format to two digits
  return `${hours.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const activityController = {
  // @desc    Get all activities for current user
  // @route   GET /api/activities
  // @access  Private
  getAllActivities: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        contactId,
        leadId,
        startDate,
        endDate,
        isCompleted,
        sortBy = "date",
        order = "desc",
      } = req.query;

      // Build filter
      const filter = { userId: req.user.id };

      if (type) filter.type = type;
      if (contactId) filter.contactId = contactId;
      if (leadId) filter.leadId = leadId;
      if (isCompleted !== undefined)
        filter.isCompleted = isCompleted === "true";

      // Date range filter
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }

      // Sort
      const sort = {};
      sort[sortBy] = order === "desc" ? -1 : 1;

      // Pagination
      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        Activity.find(filter)
          .populate("contactId", "firstName lastName email phone")
          .populate("leadId", "firstName lastName email phone status")
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit)),
        Activity.countDocuments(filter),
      ]);

      res.json({
        success: true,
        count: activities.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        data: activities,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  // @desc    Get single activity
  // @route   GET /api/activities/:id
  // @access  Private
  getActivity: async (req, res) => {
    try {
      const activity = await Activity.findById(req.params.id)
        .populate("contactId", "firstName lastName email phone company")
        .populate("leadId", "firstName lastName email phone company status")
        .populate("userId", "name email");

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  // @desc    Create new activity
  // @route   POST /api/activities
  // @access  Private
  createActivity: async (req, res) => {
    try {
      const { date, time, ...otherFields } = req.body;

      // Combine date and time into a proper Date object
      let combinedDate;

      if (date && time) {
        try {
          // Convert time to 24-hour format
          const time24 = convertTo24Hour(time);

          // Create date string in ISO format (YYYY-MM-DDTHH:mm:00)
          // Handle date format variations
          let formattedDate;
          if (date.includes("-")) {
            formattedDate = date; // Already YYYY-MM-DD
          } else if (date.includes("/")) {
            // Convert MM/DD/YYYY to YYYY-MM-DD
            const [month, day, year] = date.split("/");
            formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          } else {
            formattedDate = date; // Fallback
          }

          // Create the combined date string
          const dateTimeString = `${formattedDate}T${time24}:00`;

          // Create Date object - specify it's local time
          combinedDate = new Date(dateTimeString);

          // Validate the date
          if (isNaN(combinedDate.getTime())) {
            throw new Error("Invalid date/time combination");
          }
        } catch (error) {
          console.error("Date parsing error:", error);
          // Fallback to just date at noon
          combinedDate = new Date(`${date}T12:00:00`);
        }
      } else if (date) {
        // If only date is provided, set to noon
        combinedDate = new Date(`${date}T12:00:00`);
      } else {
        // If no date provided, use current date/time
        combinedDate = new Date();
      }

      // Create activity data
      const activityData = {
        ...otherFields,
        date: combinedDate,
        time: time, // Store original time string as well if needed
        userId: req.user.id,
      };

      // Create activity
      const activity = await Activity.create(activityData);

      // If linked to contact, update contact's lastActivity
      if (activity.contactId) {
        await Contact.findByIdAndUpdate(activity.contactId, {
          lastActivity: activity.date,
          $inc: { totalActivities: 1 },
        });
      }

      // If linked to lead, update lead's lastActivity
      if (activity.leadId) {
        await Lead.findByIdAndUpdate(activity.leadId, {
          lastActivity: activity.date,
          $inc: { totalActivities: 1 },
        });
      }

      res.status(201).json({
        success: true,
        message: "Activity created successfully",
        data: activity,
      });
    } catch (error) {
      console.error("Create activity error:", error);
      res.status(500).json({
        success: false,
        message: "Error creating activity",
        error: error.message,
      });
    }
  },

  // @desc    Update activity
  // @route   PUT /api/activities/:id
  // @access  Private
  updateActivity: async (req, res) => {
    try {
      const { date, time, ...otherFields } = req.body;

      // Don't allow userId change
      delete otherFields.userId;

      // Update lastModified
      otherFields.lastModified = Date.now();

      // Handle date/time combination if provided
      if (date || time) {
        const existingActivity = await Activity.findById(req.params.id);
        let newDate;

        if (date && time) {
          // Both date and time are being updated
          const time24 = convertTo24Hour(time);
          const dateTimeString = `${date}T${time24}:00`;
          newDate = new Date(dateTimeString);
        } else if (date && existingActivity) {
          // Only date is being updated, keep existing time
          const existingTime = existingActivity.time || "12:00";
          const time24 = convertTo24Hour(existingTime);
          const dateTimeString = `${date}T${time24}:00`;
          newDate = new Date(dateTimeString);
          otherFields.time = existingTime;
        } else if (time && existingActivity) {
          // Only time is being updated, keep existing date
          const existingDate = existingActivity.date;
          const year = existingDate.getFullYear();
          const month = (existingDate.getMonth() + 1)
            .toString()
            .padStart(2, "0");
          const day = existingDate.getDate().toString().padStart(2, "0");
          const time24 = convertTo24Hour(time);
          const dateTimeString = `${year}-${month}-${day}T${time24}:00`;
          newDate = new Date(dateTimeString);
          otherFields.time = time;
        }

        if (newDate && !isNaN(newDate.getTime())) {
          otherFields.date = newDate;
        }
      }

      const activity = await Activity.findByIdAndUpdate(
        req.params.id,
        otherFields,
        { new: true, runValidators: true },
      )
        .populate("contactId", "firstName lastName")
        .populate("leadId", "firstName lastName");

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      res.json({
        success: true,
        message: "Activity updated successfully",
        data: activity,
      });
    } catch (error) {
      console.error("Update activity error:", error);
      res.status(500).json({
        success: false,
        message: "Error updating activity",
        error: error.message,
      });
    }
  },

  // @desc    Delete activity
  // @route   DELETE /api/activities/:id
  // @access  Private
  deleteActivity: async (req, res) => {
    try {
      const activity = await Activity.findById(req.params.id);

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      // Decrement activity count from related entities before deletion
      if (activity.contactId) {
        await Contact.findByIdAndUpdate(activity.contactId, {
          $inc: { totalActivities: -1 },
        });
      }

      if (activity.leadId) {
        await Lead.findByIdAndUpdate(activity.leadId, {
          $inc: { totalActivities: -1 },
        });
      }

      await activity.deleteOne();

      res.json({
        success: true,
        message: "Activity deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error deleting activity",
        error: error.message,
      });
    }
  },

  // @desc    Get upcoming activities
  // @route   GET /api/activities/upcoming
  // @access  Private
  getUpcomingActivities: async (req, res) => {
    try {
      const { days = 7 } = req.query;
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + parseInt(days));

      const activities = await Activity.find({
        userId: req.user.id,
        date: { $gte: today, $lte: futureDate },
        isCompleted: false,
      })
        .populate("contactId", "firstName lastName phone")
        .populate("leadId", "firstName lastName phone")
        .sort({ date: 1 })
        .limit(20);

      res.json({
        success: true,
        count: activities.length,
        data: activities,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  // @desc    Get activities summary statistics
  // @route   GET /api/activities/stats
  // @access  Private
  getActivityStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // ✅ FIXED: Use mongoose.Types.ObjectId
      const matchStage = { userId: new mongoose.Types.ObjectId(req.user.id) };

      if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = new Date(startDate);
        if (endDate) matchStage.date.$lte = new Date(endDate);
      }

      const stats = await Activity.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
            completedActivities: {
              $sum: { $cond: ["$isCompleted", 1, 0] },
            },
            pendingActivities: {
              $sum: { $cond: ["$isCompleted", 0, 1] },
            },
            totalDuration: { $sum: "$duration" },
            byType: {
              $push: {
                type: "$type",
                duration: "$duration",
                completed: "$isCompleted",
              },
            },
          },
        },
        {
          $project: {
            totalActivities: 1,
            completedActivities: 1,
            pendingActivities: 1,
            totalDuration: 1,
            completionRate: {
              $multiply: [
                { $divide: ["$completedActivities", "$totalActivities"] },
                100,
              ],
            },
            avgDuration: {
              $divide: ["$totalDuration", "$totalActivities"],
            },
          },
        },
      ]);

      // Calculate type-wise statistics
      const typeStats = await Activity.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalDuration: { $sum: "$duration" },
            completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
          },
        },
        {
          $project: {
            type: "$_id",
            count: 1,
            totalDuration: 1,
            completed: 1,
            completionRate: {
              $multiply: [{ $divide: ["$completed", "$count"] }, 100],
            },
            avgDuration: { $divide: ["$totalDuration", "$count"] },
          },
        },
        { $sort: { count: -1 } },
      ]);

      res.json({
        success: true,
        data: {
          overall: stats[0] || {},
          byType: typeStats,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  // @desc    Mark activity as completed
  // @route   PATCH /api/activities/:id/complete
  // @access  Private
  markAsCompleted: async (req, res) => {
    try {
      const activity = await Activity.findByIdAndUpdate(
        req.params.id,
        {
          isCompleted: true,
          lastModified: Date.now(),
        },
        { new: true },
      );

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      res.json({
        success: true,
        message: "Activity marked as completed",
        data: activity,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  // @desc    Get activities for dashboard
  // @route   GET /api/activities/dashboard
  // @access  Private
  getDashboardActivities: async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [todaysActivities, upcomingActivities, recentActivities] =
        await Promise.all([
          // Today's activities
          Activity.find({
            userId: req.user.id,
            date: { $gte: today, $lt: tomorrow },
            isCompleted: false,
          })
            .populate("contactId", "firstName lastName")
            .populate("leadId", "firstName lastName")
            .sort({ date: 1 })
            .limit(10),

          // Upcoming activities (next 3 days)
          Activity.find({
            userId: req.user.id,
            date: {
              $gte: tomorrow,
              $lte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
            },
            isCompleted: false,
          })
            .populate("contactId", "firstName lastName")
            .populate("leadId", "firstName lastName")
            .sort({ date: 1 })
            .limit(5),

          // Recent completed activities
          Activity.find({
            userId: req.user.id,
            isCompleted: true,
          })
            .populate("contactId", "firstName lastName")
            .populate("leadId", "firstName lastName")
            .sort({ date: -1 })
            .limit(5),
        ]);

      res.json({
        success: true,
        data: {
          todaysActivities,
          upcomingActivities,
          recentActivities,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },

  // @desc    Search activities
  // @route   GET /api/activities/search
  // @access  Private
  searchActivities: async (req, res) => {
    try {
      const { query, type, isCompleted } = req.query;

      const searchFilter = { userId: req.user.id };

      // Text search
      if (query) {
        searchFilter.$or = [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { outcome: { $regex: query, $options: "i" } },
        ];
      }

      // Additional filters
      if (type) searchFilter.type = type;
      if (isCompleted !== undefined) {
        searchFilter.isCompleted = isCompleted === "true";
      }

      const activities = await Activity.find(searchFilter)
        .populate("contactId", "firstName lastName email")
        .populate("leadId", "firstName lastName email")
        .sort({ date: -1 })
        .limit(20);

      res.json({
        success: true,
        count: activities.length,
        data: activities,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },
};

module.exports = activityController;
