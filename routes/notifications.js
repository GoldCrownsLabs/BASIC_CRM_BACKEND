// routes/notifications.js - CORRECTED VERSION
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

// ✅ APPLY PROTECT MIDDLEWARE TO ALL ROUTES
router.use(protect); // ✅ USE protect NOT auth

// Routes - Now all routes are protected
router.get("/", notificationController.getNotifications);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/mark-all-read", notificationController.markAllAsRead);
router.delete("/:id", notificationController.deleteNotification);
router.post("/push-token", notificationController.updatePushToken);
router.get("/settings", notificationController.getNotificationSettings);
router.put("/settings", notificationController.updateNotificationSettings);
router.post("/test", notificationController.sendTestNotification);

// Add these routes if they exist in controller
if (notificationController.getNotificationStats) {
  router.get("/stats", notificationController.getNotificationStats);
}

if (notificationController.clearAllNotifications) {
  router.delete("/", notificationController.clearAllNotifications);
}

if (notificationController.getNotificationById) {
  router.get("/:id", notificationController.getNotificationById);
}

module.exports = router;