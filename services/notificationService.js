const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

class NotificationService {
  // Create notification in database
  static async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();

      // Update user's badge count
      await this.updateBadgeCount(notificationData.userId);

      // Send push notification if enabled
      if (notificationData.userId && notificationData.sendPush !== false) {
        await this.sendPushNotification(notification);
      }

      // Emit real-time notification via Socket.IO if available
      this.emitRealTimeNotification(notification);

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  // Send push notification
  static async sendPushNotification(notification) {
    try {
      const user = await User.findById(notification.userId);

      if (!user || !user.pushToken) {
        return null;
      }

      // Check user's notification settings
      if (!user.shouldReceiveNotification("push")) {
        return null;
      }

      // Check type-specific setting
      if (!user.shouldReceiveNotification(notification.type)) {
        return null;
      }

      if (!Expo.isExpoPushToken(user.pushToken)) {
        console.warn(`Invalid push token for user ${user._id}`);
        // Remove invalid token
        await User.findByIdAndUpdate(user._id, { $unset: { pushToken: 1 } });
        return null;
      }

      const message = {
        to: user.pushToken,
        sound:
          user.notificationSettings?.soundEnabled !== false ? "default" : null,
        title: notification.title,
        body: notification.message,
        data: {
          type: notification.type,
          ...notification.data,
          notificationId: notification._id.toString(),
          click_action: this.getClickAction(
            notification.type,
            notification.data,
          ),
        },
        badge: await this.getUserBadgeCount(user._id),
        ...(process.env.NODE_ENV === "production" && {
          priority: "high",
          ttl: 60 * 60 * 24, // 24 hours
        }),
      };

      // Remove null/undefined values
      Object.keys(message).forEach(
        (key) => message[key] == null && delete message[key],
      );

      const ticket = await expo.sendPushNotificationsAsync([message]);

      // Update notification as push sent
      notification.pushSent = true;
      notification.pushToken = user.pushToken;
      await notification.save();

      return ticket;
    } catch (error) {
      console.error("Error sending push notification:", error);

      // If token is invalid, remove it
      if (
        error.message?.includes("Invalid push token") ||
        error.message?.includes("DeviceNotRegistered")
      ) {
        await User.findByIdAndUpdate(notification.userId, {
          $unset: { pushToken: 1 },
        });
      }

      return null;
    }
  }

  // Helper: Get click action based on type
  static getClickAction(type, data) {
    const actions = {
      task: `app://task/${data.taskId}`,
      lead: `app://lead/${data.leadId}`,
      project: `app://project/${data.projectId}`,
      order: `app://order/${data.orderId}`,
      payment: `app://payment/${data.paymentId}`,
    };
    return actions[type] || "app://notifications";
  }

  // Helper: Get user badge count
  static async getUserBadgeCount(userId) {
    const count = await Notification.countDocuments({
      userId,
      read: false,
    });
    return count;
  }

  // Helper: Update badge count
  static async updateBadgeCount(userId) {
    const unreadCount = await this.getUserBadgeCount(userId);
    await User.findByIdAndUpdate(userId, {
      notificationBadgeCount: unreadCount,
    });
    return unreadCount;
  }

  // Helper: Emit real-time notification
  static async emitRealTimeNotification(notification) {
    try {
      // If Socket.IO is available
      if (global.io) {
        global.io.to(`user-${notification.userId}`).emit("new-notification", {
          ...notification.toObject(),
          timeAgo: notification.timeAgo,
        });
      }
    } catch (error) {
      console.error("Real-time notification error:", error);
    }
  }

  // Bulk create notifications
  static async createBulkNotifications(notificationsData) {
    try {
      if (!notificationsData.length) return [];

      const notifications = await Notification.insertMany(notificationsData);

      // Group by userId to update badge counts efficiently
      const userIds = [...new Set(notificationsData.map((n) => n.userId))];

      for (const userId of userIds) {
        await this.updateBadgeCount(userId);

        // Send real-time notifications
        const userNotifications = notifications.filter(
          (n) => n.userId.toString() === userId.toString(),
        );
        for (const notification of userNotifications) {
          await this.emitRealTimeNotification(notification);
        }
      }

      // Send push notifications
      for (const notification of notifications) {
        if (notification.userId) {
          await this.sendPushNotification(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
      throw error;
    }
  }

  // Task created notification (UPDATED for your User model)
  static async notifyTaskCreated(task, createdBy) {
    const notifications = [];
    const creator = await User.findById(createdBy);

    // Notify creator
    if (creator && creator.shouldReceiveNotification("task")) {
      notifications.push({
        userId: createdBy,
        title: "Task Created",
        message: `Task "${task.title}" has been created successfully`,
        type: "task",
        data: {
          taskId: task._id,
          action: "created",
          projectId: task.projectId,
          priority: task.priority,
        },
      });
    }

    // Notify assigned users
    if (task.assignedTo && task.assignedTo.length > 0) {
      const assignedUsers = await User.find({
        _id: { $in: task.assignedTo },
        isActive: true,
      });

      for (const user of assignedUsers) {
        if (
          user._id.toString() !== createdBy.toString() &&
          user.shouldReceiveNotification("task")
        ) {
          notifications.push({
            userId: user._id,
            title: "New Task Assigned",
            message: `You have been assigned: "${task.title}"`,
            type: "task",
            data: {
              taskId: task._id,
              action: "assigned",
              assignedBy: createdBy,
              dueDate: task.dueDate,
            },
          });
        }
      }
    }

    // Notify reporting managers
    if (creator) {
      const reportingChain = await creator.getReportingChain();
      for (const manager of reportingChain) {
        if (manager.shouldReceiveNotification("task")) {
          notifications.push({
            userId: manager._id,
            title: "Team Task Created",
            message: `${creator.name} created task: "${task.title}"`,
            type: "task",
            data: {
              taskId: task._id,
              action: "team_task",
              createdBy: createdBy,
              creatorName: creator.name,
            },
          });
        }
      }
    }

    return await this.createBulkNotifications(notifications);
  }

  // Lead created notification (UPDATED)
  static async notifyLeadCreated(lead, createdBy) {
    const notifications = [];
    const creator = await User.findById(createdBy);

    // Notify creator
    if (creator && creator.shouldReceiveNotification("lead")) {
      notifications.push({
        userId: createdBy,
        title: "Lead Created",
        message: `New lead "${lead.name}" has been added`,
        type: "lead",
        data: {
          leadId: lead._id,
          action: "created",
          source: lead.source,
          status: lead.status,
        },
      });
    }

    // Notify assigned sales person
    if (lead.assignedTo) {
      const assignedUser = await User.findById(lead.assignedTo);
      if (
        assignedUser &&
        assignedUser._id.toString() !== createdBy.toString() &&
        assignedUser.shouldReceiveNotification("lead")
      ) {
        notifications.push({
          userId: lead.assignedTo,
          title: "New Lead Assigned",
          message: `Lead "${lead.name}" assigned to you`,
          type: "lead",
          data: {
            leadId: lead._id,
            action: "assigned",
            assignedBy: createdBy,
            leadValue: lead.value,
          },
        });
      }
    }

    // Notify sales managers
    const salesManagers = await User.find({
      role: { $in: ["manager", "supervisor"] },
      department: "sales",
      isActive: true,
    });

    for (const manager of salesManagers) {
      if (manager.shouldReceiveNotification("lead")) {
        notifications.push({
          userId: manager._id,
          title: "New Lead Added",
          message: `New lead "${lead.name}" added to system`,
          type: "lead",
          data: {
            leadId: lead._id,
            action: "manager_notify",
            createdBy: createdBy,
            creatorName: creator?.name,
          },
        });
      }
    }

    return await this.createBulkNotifications(notifications);
  }

  // Order notification
  static async notifyOrderCreated(order, userId) {
    const user = await User.findById(userId);
    if (!user || !user.shouldReceiveNotification("order")) return null;

    return await this.createNotification({
      userId,
      title: "Order Placed",
      message: `Your order #${order.orderNumber} has been placed successfully`,
      type: "order",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
      },
    });
  }

  // Payment notification
  static async notifyPaymentReceived(payment, userId) {
    const user = await User.findById(userId);
    if (!user || !user.shouldReceiveNotification("payment")) return null;

    return await this.createNotification({
      userId,
      title: "Payment Received",
      message: `Payment of ₹${payment.amount} received for order #${payment.orderNumber}`,
      type: "payment",
      data: {
        paymentId: payment._id,
        orderId: payment.orderId,
        amount: payment.amount,
        method: payment.method,
      },
    });
  }

  // System notification
  static async sendSystemNotification(userId, title, message, data = {}) {
    return await this.createNotification({
      userId,
      title,
      message,
      type: "system",
      data,
    });
  }

  // Get user notifications
  static async getUserNotifications(userId, options = {}) {
    const { limit = 20, skip = 0, unreadOnly = false, type } = options;

    const query = { userId };
    if (unreadOnly) {
      query.read = false;
    }
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await this.getUserBadgeCount(userId);

    // Update last check time
    await User.findByIdAndUpdate(userId, {
      lastNotificationCheck: new Date(),
    });

    // Add timeAgo to each notification
    const enrichedNotifications = notifications.map((notification) => ({
      ...notification,
      timeAgo: this.calculateTimeAgo(notification.createdAt),
    }));

    return {
      notifications: enrichedNotifications,
      pagination: {
        total,
        limit,
        skip,
        hasMore: total > skip + limit,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  // Helper: Calculate time ago
  static calculateTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
    if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
    if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
    return "Just now";
  }

  // Mark as read
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true },
    );

    if (notification) {
      await this.updateBadgeCount(userId);
      await this.emitRealTimeNotification(notification);
    }

    return notification;
  }

  // Mark all as read
  static async markAllAsRead(userId) {
    await Notification.updateMany({ userId, read: false }, { read: true });

    await this.updateBadgeCount(userId);

    // Emit update via socket
    if (global.io) {
      global.io.to(`user-${userId}`).emit("notifications-read", { all: true });
    }

    return true;
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (notification) {
      await this.updateBadgeCount(userId);

      // Emit deletion via socket
      if (global.io) {
        global.io.to(`user-${userId}`).emit("notification-deleted", {
          notificationId: notificationId,
        });
      }
    }

    return notification;
  }

  // Clear expired notifications
  static async clearExpired() {
    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  }

  // Get notification statistics
  static async getNotificationStats(userId) {
    try {
      // Simple count approach (no aggregation needed)
      const [total, unread] = await Promise.all([
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, read: false }),
      ]);

      // Get counts by type
      const typeStats = await Notification.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: "$type",
            total: { $sum: 1 },
            unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$read", true] }, 1, 0] } },
          },
        },
        {
          $project: {
            type: "$_id",
            total: 1,
            unread: 1,
            read: 1,
            _id: 0,
          },
        },
        { $sort: { type: 1 } },
      ]);

      // Convert array to object
      const byType = {};
      typeStats.forEach((stat) => {
        byType[stat.type] = {
          total: stat.total,
          unread: stat.unread,
          read: stat.read,
        };
      });

      return {
        total,
        unread,
        read: total - unread,
        byType,
      };
    } catch (error) {
      console.error("Get notification stats error:", error);
      return { total: 0, unread: 0, read: 0, byType: {} };
    }
  }
}

module.exports = NotificationService;
