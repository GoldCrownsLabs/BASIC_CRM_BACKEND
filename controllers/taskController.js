// controllers/taskController.js

const Task = require("../models/Task");
const mongoose = require("mongoose");
// ❌ PURANA HATAO
// const NotificationService = require("../services/notificationService");

// ✅ NAYA LAGAO
const Notification = require("../services/notifications");

/**
 * Get all tasks
 */
const getTasks = async (req, res) => {
  try {
    console.log("🚀 GET /api/tasks called");
    console.log("👤 User:", req.user._id, req.user.email);

    const query = { userId: req.user._id.toString() };
    console.log("🔍 Query:", query);

    const tasks = await Task.find(query)
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    console.log(`✅ Found ${tasks.length} tasks`);

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error("🔥 GET /tasks ERROR:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid data format: ${error.message}`,
      });
    }

    if (error.name === "MongoError") {
      return res.status(500).json({
        success: false,
        message: `Database error: ${error.message}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      debug: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get single task
 */
const getTaskById = async (req, res) => {
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
};

/**
 * Create task with notification
 */
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      reminderDate,
      contactId,
      leadId,
      assignedTo,
    } = req.body;

    console.log("Request body:", req.body);

    // Basic validation
    if (!title || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Title and due date are required fields",
      });
    }

    // Parse dates
    const dueDateObj = new Date(dueDate);
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

    // Validate reminder date
    if (reminderDate) {
      const reminderDateObj = new Date(reminderDate);
      if (reminderDateObj >= dueDateObj) {
        return res.status(400).json({
          success: false,
          message: "Reminder date must be before due date",
        });
      }
    }

    // Validate assignedTo
    let assignedToArray = [];
    if (assignedTo) {
      if (Array.isArray(assignedTo)) {
        assignedToArray = assignedTo;
      } else {
        assignedToArray = [assignedTo];
      }

      for (const userId of assignedToArray) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid user ID in assignedTo",
          });
        }
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

    // Add optional fields
    if (reminderDate) taskData.reminderDate = new Date(reminderDate);
    if (contactId && mongoose.Types.ObjectId.isValid(contactId))
      taskData.contactId = contactId;
    if (leadId && mongoose.Types.ObjectId.isValid(leadId))
      taskData.leadId = leadId;
    if (assignedToArray.length > 0) taskData.assignedTo = assignedToArray;

    console.log("Creating task with data:", taskData);

    // Create task
    const task = await Task.create(taskData);

    // ✅ FIXED: Use new notification service
    try {
      await Notification.task.notifyTaskCreated(task, req.user._id);
      console.log("✅ Notification sent for task creation");
    } catch (notificationError) {
      console.error("❌ Failed to send notification:", notificationError);
      // Don't fail the request
    }

    // Send response
    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    console.error("❌ Create task error:", error);
    console.error("❌ Error stack:", error.stack);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error: " + messages.join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate task found",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error occurred while creating task",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/**
 * Update task with notification
 */
const updateTask = async (req, res) => {
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
      assignedTo,
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

    // Store old values for comparison
    const oldStatus = task.status;
    const oldAssignedTo = task.assignedTo || [];

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

    // Handle assignedTo update
    let newAssignedTo = [];
    if (assignedTo !== undefined) {
      if (Array.isArray(assignedTo)) {
        newAssignedTo = assignedTo;
      } else if (assignedTo) {
        newAssignedTo = [assignedTo];
      }
      updateFields.assignedTo = newAssignedTo;
    } else {
      newAssignedTo = oldAssignedTo;
    }

    // Validate dates
    if (dueDate && new Date(dueDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Due date must be in the future",
      });
    }

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
    });

    // ✅ FIXED: Use new notification service
    try {
      // 1. Task updated notification to creator
      await Notification.task.notifyTaskUpdated(
        task,
        req.user._id,
        updateFields,
      );

      // 2. Notify newly assigned users
      const newlyAssigned = newAssignedTo.filter(
        (userId) => !oldAssignedTo.includes(userId.toString()),
      );

      for (const userId of newlyAssigned) {
        await Notification.task.notifyTaskCreated(task, req.user._id);
      }

      // 3. Notify if task completed
      if (status === "completed" && oldStatus !== "completed") {
        await Notification.task.notifyTaskCompleted(task, req.user._id);
      }

      console.log("✅ Notifications sent for task update");
    } catch (notificationError) {
      console.error("❌ Failed to send notification:", notificationError);
    }

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
};

/**
 * Delete task
 */
const deleteTask = async (req, res) => {
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
};

/**
 * Bulk update task status
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const { taskIds, status } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of task IDs",
      });
    }

    if (
      !["pending", "in_progress", "completed", "cancelled"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid status value",
      });
    }

    const validTaskIds = taskIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );
    if (validTaskIds.length !== taskIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more task IDs are invalid",
      });
    }

    const updateFields = {
      status,
      lastModified: new Date(),
    };

    if (status === "completed") {
      updateFields.completedAt = new Date();
    }

    const result = await Task.updateMany(
      {
        _id: { $in: validTaskIds },
        userId: req.user._id,
      },
      updateFields,
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
};

/**
 * Get today's tasks
 */
const getTodayTasks = async (req, res) => {
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
};

/**
 * Get overdue tasks
 */
const getOverdueTasks = async (req, res) => {
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
};

/**
 * Get upcoming tasks
 */
const getUpcomingTasks = async (req, res) => {
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
};

/**
 * Get task statistics
 */
const getTaskStats = async (req, res) => {
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
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  bulkUpdateStatus,
  getTodayTasks,
  getOverdueTasks,
  getUpcomingTasks,
  getTaskStats,
};
