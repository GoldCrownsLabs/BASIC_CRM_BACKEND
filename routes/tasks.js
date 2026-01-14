const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks with filters
 * @access  Private
 */
/**
 * @route   GET /api/tasks
 * @desc    Get all tasks with filters
 * @access  Private
 */
router.get("/", protect, async (req, res) => {
  try {
    console.log("🚀 GET /api/tasks called");
    console.log("👤 User:", req.user._id, req.user.email);
    console.log("📋 Query params:", req.query);
    
    // Basic query - just get tasks for this user
    const query = { userId: req.user._id.toString() };
    console.log("🔍 Query:", query);
    
    // Try without populate first
    const tasks = await Task.find(query)
      .select("-__v") // Remove version field
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(); // Convert to plain JavaScript objects
    
    console.log(`✅ Found ${tasks.length} tasks`);
    
    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
    
  } catch (error) {
    console.error("🔥 GET /tasks ERROR:", error);
    console.error("🔥 Error name:", error.name);
    console.error("🔥 Error message:", error.message);
    console.error("🔥 Error stack:", error.stack);
    
    // Check specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid data format: ${error.message}`
      });
    }
    
    if (error.name === 'MongoError') {
      return res.status(500).json({
        success: false,
        message: `Database error: ${error.message}`
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/tasks/:id
 * @desc    Get single task by ID
 * @access  Private
 */
router.get("/:id", protect, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .populate("contactId", "name email phone")
      .populate("leadId", "name email phone");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Get task error:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error occurred while fetching task",
    });
  }
});

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post("/", protect, async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      reminderDate,
      contactId,
      leadId,
    } = req.body;

    console.log("Request body:", req.body); // Add logging

    // Basic validation
    if (!title || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Title and due date are required fields",
      });
    }

    // Parse and validate dates
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    
    // Remove time for date-only comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDateOnly = new Date(dueDateObj);
    dueDateOnly.setHours(0, 0, 0, 0);

    // Allow due dates for today and future
    if (dueDateOnly < today) {
      return res.status(400).json({
        success: false,
        message: "Due date must be today or in the future",
      });
    }

    // Validate reminder date if provided
    if (reminderDate) {
      const reminderDateObj = new Date(reminderDate);
      if (reminderDateObj >= dueDateObj) {
        return res.status(400).json({
          success: false,
          message: "Reminder date must be before due date",
        });
      }
    }

    // Prepare task data
    const taskData = {
      userId: req.user._id,
      title,
      description: description || "",
      priority: priority || "medium",
      dueDate: dueDateObj,
      status: "pending",
    };

    // Add optional fields with validation
    if (reminderDate) {
      taskData.reminderDate = new Date(reminderDate);
    }
    
    if (contactId) {
      if (!mongoose.Types.ObjectId.isValid(contactId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contact ID format",
        });
      }
      taskData.contactId = contactId;
    }
    
    if (leadId) {
      if (!mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID format",
        });
      }
      taskData.leadId = leadId;
    }

    console.log("Creating task with data:", taskData);

    // Create task
    const task = await Task.create(taskData);

    // Send response
    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });

  } catch (error) {
    console.error("❌ Create task error:", error);
    console.error("❌ Error stack:", error.stack);
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error: " + messages.join(", "),
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate task found",
      });
    }

    // Handle cast errors (invalid ObjectId, etc.)
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      message: "Server error occurred while creating task",
      // Only include error details in development
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.put("/:id", protect, async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      status,
      dueDate,
      reminderDate,
      contactId,
      leadId,
    } = req.body;

    // Find task
    let task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Prepare update fields
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (priority !== undefined) updateFields.priority = priority;
    if (status !== undefined) updateFields.status = status;
    if (dueDate !== undefined) updateFields.dueDate = new Date(dueDate);

    if (reminderDate !== undefined) {
      updateFields.reminderDate = reminderDate ? new Date(reminderDate) : null;
      updateFields.isReminderSent = false;
    }

    if (contactId !== undefined) updateFields.contactId = contactId;
    if (leadId !== undefined) updateFields.leadId = leadId;

    // Validate due date if being updated
    if (dueDate && new Date(dueDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Due date must be in the future",
      });
    }

    // Validate reminder date if being updated
    if (
      reminderDate &&
      dueDate &&
      new Date(reminderDate) >= new Date(dueDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Reminder date must be before due date",
      });
    }

    // Set completedAt if status changed to completed
    if (status === "completed" && task.status !== "completed") {
      updateFields.completedAt = new Date();
    }

    // Update task
    task = await Task.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
    })
      .populate("contactId", "name email phone")
      .populate("leadId", "name email phone");

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    console.error("Update task error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error occurred while updating task",
    });
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("Delete task error:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error occurred while deleting task",
    });
  }
});

/**
 * @route   PATCH /api/tasks/bulk-status
 * @desc    Bulk update task status
 * @access  Private
 */
router.patch("/bulk-status", protect, async (req, res) => {
  try {
    const { taskIds, status } = req.body;

    // Validate input
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of task IDs",
      });
    }

    if (
      !status ||
      !["pending", "in_progress", "completed", "cancelled"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid status value",
      });
    }

    // Validate all IDs
    const validTaskIds = taskIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (validTaskIds.length !== taskIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more task IDs are invalid",
      });
    }

    // Prepare update
    const updateFields = {
      status,
      lastModified: new Date(),
    };

    // Add completedAt if marking as completed
    if (status === "completed") {
      updateFields.completedAt = new Date();
    }

    // Update tasks
    const result = await Task.updateMany(
      {
        _id: { $in: validTaskIds },
        userId: req.user._id,
      },
      updateFields
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} task(s) updated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred during bulk update",
    });
  }
});

/**
 * @route   GET /api/tasks/analytics/today
 * @desc    Get today's tasks
 * @access  Private
 */
router.get("/analytics/today", protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = await Task.find({
      userId: req.user._id,
      dueDate: {
        $gte: today,
        $lt: tomorrow,
      },
      status: { $ne: "completed" },
    })
      .populate("contactId", "name email phone")
      .populate("leadId", "name email phone")
      .sort({ priority: -1, dueDate: 1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error("Get today tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while fetching today's tasks",
    });
  }
});

/**
 * @route   GET /api/tasks/analytics/overdue
 * @desc    Get overdue tasks
 * @access  Private
 */
router.get("/analytics/overdue", protect, async (req, res) => {
  try {
    const now = new Date();

    const tasks = await Task.find({
      userId: req.user._id,
      dueDate: { $lt: now },
      status: { $in: ["pending", "in_progress"] },
    })
      .populate("contactId", "name email phone")
      .populate("leadId", "name email phone")
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error("Get overdue tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while fetching overdue tasks",
    });
  }
});

/**
 * @route   GET /api/tasks/analytics/upcoming
 * @desc    Get upcoming tasks (next 7 days)
 * @access  Private
 */
router.get("/analytics/upcoming", protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const tasks = await Task.find({
      userId: req.user._id,
      dueDate: {
        $gte: today,
        $lte: nextWeek,
      },
      status: { $in: ["pending", "in_progress"] },
    })
      .populate("contactId", "name email phone")
      .populate("leadId", "name email phone")
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error("Get upcoming tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while fetching upcoming tasks",
    });
  }
});

/**
 * @route   GET /api/tasks/analytics/stats
 * @desc    Get task statistics
 * @access  Private
 */
router.get("/analytics/stats", protect, async (req, res) => {
  try {
    // Status statistics
    const statusStats = await Task.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Priority statistics
    const priorityStats = await Task.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    // Today's tasks count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTasks = await Task.countDocuments({
      userId: req.user._id,
      dueDate: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // Overdue tasks count
    const now = new Date();
    const overdueTasks = await Task.countDocuments({
      userId: req.user._id,
      dueDate: { $lt: now },
      status: { $in: ["pending", "in_progress"] },
    });

    // Total tasks
    const totalTasks = await Task.countDocuments({ userId: req.user._id });

    // Format results
    const result = {
      statusStats: {},
      priorityStats: {},
      todayTasks,
      overdueTasks,
      totalTasks,
    };

    statusStats.forEach((stat) => {
      result.statusStats[stat._id] = stat.count;
    });

    priorityStats.forEach((stat) => {
      result.priorityStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while fetching statistics",
    });
  }
});
module.exports = router;