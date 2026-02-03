// controllers/notificationController.js
const NotificationService = require("../services/notificationService");
const User = require("../models/User");

// Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const skip = (page - 1) * limit;

    const result = await NotificationService.getUserNotifications(
      req.user._id,
      {
        limit: parseInt(limit),
        skip,
        unreadOnly: unread === "true",
      },
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
    const notification = await NotificationService.markAsRead(
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
    await NotificationService.markAllAsRead(req.user._id);

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
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    // Update badge count
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    await User.findByIdAndUpdate(req.user._id, {
      notificationBadgeCount: unreadCount,
    });

    res.json({
      success: true,
      message: "Notification deleted",
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
    const notification = await NotificationService.createNotification({
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
