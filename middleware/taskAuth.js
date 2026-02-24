const Task = require("../models/Task");
const mongoose = require("mongoose");

const taskAuth = {
  // ✅ Check if task exists and belongs to user
  checkTaskOwnership: async (req, res, next) => {
    try {
      const taskId = req.params.id;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          message: "Task ID is required",
        });
      }

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID format",
        });
      }

      const task = await Task.findOne({
        _id: taskId,
        userId: req.user._id,
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Task not found or you don't have permission",
        });
      }

      req.task = task; // Attach task to request for later use
      next();
    } catch (error) {
      console.error("Task ownership check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking task ownership",
      });
    }
  },

  // ✅ Check bulk update permissions
  checkBulkUpdatePermission: async (req, res, next) => {
    try {
      const { taskIds } = req.body;

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide an array of task IDs",
        });
      }

      // Validate all IDs
      const invalidIds = taskIds.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: "One or more task IDs are invalid",
        });
      }

      // Check if user owns all tasks
      const ownedTasks = await Task.countDocuments({
        _id: { $in: taskIds },
        userId: req.user._id,
      });

      if (ownedTasks !== taskIds.length) {
        return res.status(403).json({
          success: false,
          message: "You can only update tasks you own",
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

  // ✅ Validate task data
  validateTaskData: (req, res, next) => {
    const { title, dueDate, priority, status } = req.body;

    // For POST requests (create)
    if (req.method === "POST") {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title is required",
        });
      }

      if (!dueDate) {
        return res.status(400).json({
          success: false,
          message: "Due date is required",
        });
      }
    }

    // Validate due date if provided
    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueDateOnly = new Date(dueDateObj);
      dueDateOnly.setHours(0, 0, 0, 0);

      if (dueDateOnly < today) {
        return res.status(400).json({
          success: false,
          message: "Due date must be today or in the future",
        });
      }
    }

    // Validate priority if provided
    if (priority && !["low", "medium", "high", "urgent"].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Priority must be low, medium, high, or urgent",
      });
    }

    // Validate status if provided
    if (
      status &&
      !["pending", "in_progress", "completed", "cancelled"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, in_progress, completed, or cancelled",
      });
    }

    // Validate reminder date if provided
    if (req.body.reminderDate && dueDate) {
      const reminderDateObj = new Date(req.body.reminderDate);
      const dueDateObj = new Date(dueDate);

      if (reminderDateObj >= dueDateObj) {
        return res.status(400).json({
          success: false,
          message: "Reminder date must be before due date",
        });
      }
    }

    next();
  },

  // ✅ Validate assigned users
  validateAssignedUsers: async (req, res, next) => {
    try {
      const { assignedTo } = req.body;

      if (!assignedTo) {
        return next();
      }

      let assignedToArray = [];
      if (Array.isArray(assignedTo)) {
        assignedToArray = assignedTo;
      } else {
        assignedToArray = [assignedTo];
      }

      // Validate all user IDs
      const User = require("../models/User");

      for (const userId of assignedToArray) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid user ID format: ${userId}`,
          });
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.status(400).json({
            success: false,
            message: `User not found with ID: ${userId}`,
          });
        }
      }

      next();
    } catch (error) {
      console.error("Validate assigned users error:", error);
      res.status(500).json({
        success: false,
        message: "Error validating assigned users",
      });
    }
  },

  // ✅ Check if user can view task (owner or assigned)
  checkCanView: async (req, res, next) => {
    try {
      const taskId = req.params.id;

      const task = await Task.findOne({
        _id: taskId,
        $or: [
          { userId: req.user._id }, // Owner
          { assignedTo: req.user._id }, // Assigned
        ],
      });

      if (!task) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this task",
        });
      }

      req.task = task;
      next();
    } catch (error) {
      console.error("Task view check error:", error);
      res.status(500).json({
        success: false,
        message: "Error checking view permission",
      });
    }
  },
};

module.exports = taskAuth;
