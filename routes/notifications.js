// routes/notifications.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const auth = require("../middleware/auth"); // Assuming you have auth middleware

// All routes require authentication
router.use(auth);

// Get notifications
router.get("/", notificationController.getNotifications);

// Mark as read
router.patch("/:id/read", notificationController.markAsRead);

// Mark all as read
router.patch("/mark-all-read", notificationController.markAllAsRead);

// Delete notification
router.delete("/:id", notificationController.deleteNotification);

// Push token
router.post("/push-token", notificationController.updatePushToken);

// Settings
router.get("/settings", notificationController.getNotificationSettings);
router.put("/settings", notificationController.updateNotificationSettings);

// Test
router.post("/test", notificationController.sendTestNotification);

module.exports = router;
