const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const taskController = require("../controllers/taskController");
const taskAuth = require("../middleware/taskAuth"); // ✅ Import karo

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks with filters
 * @access  Private
 * ✅ Controller already has userId filter
 */
router.get("/", protect, taskController.getTasks);

/**
 * @route   GET /api/tasks/analytics/today
 * @desc    Get today's tasks
 * @access  Private
 * ✅ Controller already has userId filter
 */
router.get("/analytics/today", protect, taskController.getTodayTasks);

/**
 * @route   GET /api/tasks/analytics/overdue
 * @desc    Get overdue tasks
 * @access  Private
 * ✅ Controller already has userId filter
 */
router.get("/analytics/overdue", protect, taskController.getOverdueTasks);

/**
 * @route   GET /api/tasks/analytics/upcoming
 * @desc    Get upcoming tasks (next 7 days)
 * @access  Private
 * ✅ Controller already has userId filter
 */
router.get("/analytics/upcoming", protect, taskController.getUpcomingTasks);

/**
 * @route   GET /api/tasks/analytics/stats
 * @desc    Get task statistics
 * @access  Private
 * ✅ Controller already has userId filter
 */
router.get("/analytics/stats", protect, taskController.getTaskStats);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 * ✅ Added validation
 */
router.post(
  "/",
  protect,
  taskAuth.validateTaskData,
  taskAuth.validateAssignedUsers,
  taskController.createTask,
);

/**
 * @route   PATCH /api/tasks/bulk-status
 * @desc    Bulk update task status
 * @access  Private
 * ✅ Added ownership check for bulk update
 */
router.patch(
  "/bulk-status",
  protect,
  taskAuth.checkBulkUpdatePermission,
  taskController.bulkUpdateStatus,
);

// ======== INDIVIDUAL TASK ROUTES (with ID) ========

/**
 * @route   GET /api/tasks/:id
 * @desc    Get single task by ID
 * @access  Private
 * ✅ Added ownership check
 */
router.get(
  "/:id",
  protect,
  taskAuth.checkTaskOwnership,
  taskController.getTaskById,
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 * ✅ Added ownership check + validation
 */

// Note: PUT is used for full updates, so all fields should be validated and required in the controller
router.put(
  "/:id",
  protect,
  taskAuth.checkTaskOwnership,
  taskAuth.validateTaskData,
  taskAuth.validateAssignedUsers,
  taskController.updateTask,
);
// If you want to support partial updates, consider using PATCH and adjusting the validation accordingly

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 * ✅ Added ownership check
 */
router.delete(
  "/:id",
  protect,
  taskAuth.checkTaskOwnership,
  taskController.deleteTask,
);

module.exports = router;
