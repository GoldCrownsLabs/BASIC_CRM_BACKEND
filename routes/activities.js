const express = require("express");
const router = express.Router();

const activityController = require("../controllers/activityController");
const authActivity = require("../middleware/authActivity");

// Apply auth middleware to all routes
router.use(authActivity.protect);

// @route   GET /api/activities
// @desc    Get all activities for current user
// @access  Private
router.get("/", activityController.getAllActivities);

// @route   GET /api/activities/stats
// @desc    Get activities statistics
// @access  Private
router.get("/stats", activityController.getActivityStats);

// @route   GET /api/activities/upcoming
// @desc    Get upcoming activities
// @access  Private
router.get("/upcoming", activityController.getUpcomingActivities);

// @route   GET /api/activities/dashboard
// @desc    Get activities for dashboard
// @access  Private
router.get("/dashboard", activityController.getDashboardActivities);

// @route   GET /api/activities/search
// @desc    Search activities
// @access  Private
router.get("/search", activityController.searchActivities);

// @route   POST /api/activities
// @desc    Create new activity
// @access  Private
router.post(
  "/",
  authActivity.validateActivityData,
  authActivity.checkRelatedEntities,
  activityController.createActivity
);

// @route   GET /api/activities/:id
// @desc    Get single activity
// @access  Private
router.get(
  "/:id",
  authActivity.checkActivityOwnership,
  activityController.getActivity
);

// @route   PUT /api/activities/:id
// @desc    Update activity
// @access  Private
router.put(
  "/:id",
  authActivity.checkActivityOwnership,
  authActivity.validateActivityData,
  authActivity.checkRelatedEntities,
  activityController.updateActivity
);

// @route   PATCH /api/activities/:id/complete
// @desc    Mark activity as completed
// @access  Private
router.patch(
  "/:id/complete",
  authActivity.checkActivityOwnership,
  activityController.markAsCompleted
  
);

// @route   DELETE /api/activities/:id
// @desc    Delete activity
// @access  Private
router.delete(
  "/:id",
  authActivity.checkActivityOwnership,
  activityController.deleteActivity
);

module.exports = router;
