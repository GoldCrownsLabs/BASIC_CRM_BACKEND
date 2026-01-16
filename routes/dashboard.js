const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/authDashboard");

// Import the correct middleware
const authMiddleware = require("../middleware/authDashboard");

// Apply authentication middleware to all dashboard routes
router.use(authMiddleware);

// Dashboard summary
router.get("/summary", dashboardController.getDashboardSummary);

// Recent items
router.get("/recent", dashboardController.getRecentItems);

// Activity timeline
router.get("/timeline", dashboardController.getActivityTimeline);

// Performance metrics
router.get("/metrics", dashboardController.getPerformanceMetrics);

// Quick stats (for dashboard cards/widgets)
router.get("/quick-stats", dashboardController.getQuickStats);

// Search across all entities
router.get("/search", dashboardController.searchDashboard);

// Test route
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CRM Dashboard API is working! ✅",
    endpoints: [
      "GET /summary - Dashboard summary",
      "GET /recent - Recent items",
      "GET /timeline - Activity timeline",
      "GET /metrics - Performance metrics",
      "GET /quick-stats - Quick stats",
      "GET /search?q=query - Search dashboard",
    ],
    user: req.user
      ? {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        }
      : "No user data",
  });
});

module.exports = router;
