// controllers/notificationController.js

// ❌ PURANA HATAO
// const NotificationService = require("../services/notificationService");

// ✅ NAYA LAGAO
const Notification = require("../services/notifications");

const User = require("../models/User");
const NotificationModel = require("../models/Notification"); // Renamed to avoid conflict

exports.getNotifications = async (req, res) => {
  try {
    console.log("🔍 DEBUG: Notification request from user:", req.user?._id);

    if (!req.user || !req.user._id) {
      console.error(
        "❌ ERROR: User not authenticated in notification controller",
      );
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
        debug: "Check if protect middleware is working",
      });
    }

    const { page = 1, limit = 20, unread, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ Use new notification service
    const result = await Notification.core.getUserNotifications(req.user._id, {
      limit: parseInt(limit),
      skip,
      unreadOnly: unread === "true",
      type: type || undefined,
    });

    console.log(
      `✅ Fetched ${result.notifications?.length || 0} notifications for user ${req.user._id}`,
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    // ✅ Use new notification service
    const notification = await Notification.core.markAsRead(
      req.params.id,
      req.user._id,
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    // ✅ Use new notification service
    await Notification.core.markAllAsRead(req.user._id);

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read",
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    // ✅ Use new notification service
    const notification = await Notification.core.delete(
      req.params.id,
      req.user._id,
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
};

// Update push token
exports.updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: "Push token is required",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      pushToken,
    });

    res.json({
      success: true,
      message: "Push token updated successfully",
    });
  } catch (error) {
    console.error("Update push token error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update push token",
    });
  }
};

// Get notification settings
exports.getNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "notificationSettings pushToken",
    );

    res.json({
      success: true,
      settings: user.notificationSettings || {},
      pushToken: user.pushToken,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification settings",
    });
  }
};

// Update notification settings
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
      return res.status(400).json({
        success: false,
        error: "Valid settings object is required",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $set: { notificationSettings: settings },
    });

    res.json({
      success: true,
      message: "Notification settings updated successfully",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update notification settings",
    });
  }
};

// Test notification
exports.sendTestNotification = async (req, res) => {
  try {
    // ✅ Use new notification service
    const notification = await Notification.core.create({
      userId: req.user._id,
      title: "Test Notification",
      message: "This is a test notification from the server",
      type: "system",
      data: { test: true, timestamp: new Date().toISOString() },
    });

    res.json({
      success: true,
      notification,
      message: "Test notification sent successfully",
    });
  } catch (error) {
    console.error("Test notification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send test notification",
    });
  }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
  try {
    // ✅ Use new notification service
    const stats = await Notification.core.getStats(req.user._id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification statistics",
    });
  }
};

// Clear all notifications
exports.clearAllNotifications = async (req, res) => {
  try {
    // Delete all notifications for user
    await NotificationModel.deleteMany({ userId: req.user._id });

    // Update badge count
    await Notification.core.updateBadgeCount(req.user._id);

    res.json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("Clear all error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear notifications",
    });
  }
};

// Get notification by ID
exports.getNotificationById = async (req, res) => {
  try {
    // ✅ Use NotificationModel directly (not service)
    const notification = await NotificationModel.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      notification: {
        ...notification.toObject(),
        timeAgo: notification.timeAgo, // Use virtual field
      },
    });
  } catch (error) {
    console.error("Get notification by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification",
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    // ✅ Use new notification service
    const count = await Notification.core.getBadgeCount(req.user._id);

    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get unread count",
    });
  }
};

// Bulk delete notifications
exports.bulkDeleteNotifications = async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: "Notification IDs array is required",
      });
    }

    // Delete only user's own notifications
    const result = await NotificationModel.deleteMany({
      _id: { $in: notificationIds },
      userId: req.user._id,
    });

    // Update badge count
    await Notification.core.updateBadgeCount(req.user._id);

    res.json({
      success: true,
      message: `${result.deletedCount} notifications deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete notifications",
    });
  }
};
