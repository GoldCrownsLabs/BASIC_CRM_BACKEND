const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const taskController = require("../controllers/taskController");

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks with filters
 * @access  Private
 */
router.get("/", protect, taskController.getTasks);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get single task by ID
 * @access  Private
 */
router.get("/:id", protect, taskController.getTaskById);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post("/", protect, taskController.createTask);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.put("/:id", protect, taskController.updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete("/:id", protect, taskController.deleteTask);

/**
 * @route   PATCH /api/tasks/bulk-status
 * @desc    Bulk update task status
 * @access  Private
 */
router.patch("/bulk-status", protect, taskController.bulkUpdateStatus);

/**
 * @route   GET /api/tasks/analytics/today
 * @desc    Get today's tasks
 * @access  Private
 */
router.get("/analytics/today", protect, taskController.getTodayTasks);

/**
 * @route   GET /api/tasks/analytics/overdue
 * @desc    Get overdue tasks
 * @access  Private
 */
router.get("/analytics/overdue", protect, taskController.getOverdueTasks);

/**
 * @route   GET /api/tasks/analytics/upcoming
 * @desc    Get upcoming tasks (next 7 days)
 * @access  Private
 */
router.get("/analytics/upcoming", protect, taskController.getUpcomingTasks);

/**
 * @route   GET /api/tasks/analytics/stats
 * @desc    Get task statistics
 * @access  Private
 */
router.get("/analytics/stats", protect, taskController.getTaskStats);

module.exports = router;
