// services/notifications/coreNotification.js

const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const { Expo } = require("expo-server-sdk");
const BaseNotification = require("./baseNotification");

const expo = new Expo();

/**
 * Core Notification Module - Basic CRUD operations
 */
class CoreNotification extends BaseNotification {
  /**
   * Create a single notification
   */
  static async create(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();

      // Update badge count
      await this.updateBadgeCount(notificationData.userId);

      // Send push if enabled
      if (notificationData.userId && notificationData.sendPush !== false) {
        await this.sendPush(notification);
      }

      // Emit real-time
      this.emitRealTime(notification);

      return notification;
    } catch (error) {
      console.error("❌ CoreNotification.create error:", error);
      throw error;
    }
  }

  /**
   * Create multiple notifications in bulk
   */
  static async createBulk(notificationsData) {
    try {
      if (!notificationsData.length) return [];

      const notifications = await Notification.insertMany(notificationsData);

      // Group by userId and update badges
      const userIds = [...new Set(notificationsData.map((n) => n.userId))];

      for (const userId of userIds) {
        await this.updateBadgeCount(userId);

        // Send real-time
        const userNotifications = notifications.filter(
          (n) => n.userId.toString() === userId.toString(),
        );
        for (const notification of userNotifications) {
          await this.emitRealTime(notification);
        }
      }

      // Send push notifications
      for (const notification of notifications) {
        if (notification.userId) {
          await this.sendPush(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error("❌ CoreNotification.createBulk error:", error);
      throw error;
    }
  }

  /**
   * Send push notification via Expo
   */
  static async sendPush(notification) {
    try {
      const user = await User.findById(notification.userId);

      if (!user || !user.pushToken) return null;

      // Check user's notification settings
      if (!user.shouldReceiveNotification?.("push")) return null;

      if (!Expo.isExpoPushToken(user.pushToken)) {
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
        badge: await this.getBadgeCount(user._id),
        ...(process.env.NODE_ENV === "production" && {
          priority: "high",
          ttl: 60 * 60 * 24,
        }),
      };

      // Remove null values
      Object.keys(message).forEach(
        (key) => message[key] == null && delete message[key],
      );

      const ticket = await expo.sendPushNotificationsAsync([message]);

      // Update notification
      notification.pushSent = true;
      notification.pushToken = user.pushToken;
      await notification.save();

      return ticket;
    } catch (error) {
      console.error("❌ CoreNotification.sendPush error:", error);

      // Remove invalid token
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

  /**
   * Emit real-time notification via Socket.IO
   */
  static emitRealTime(notification) {
    try {
      if (global.io) {
        global.io.to(`user-${notification.userId}`).emit("new-notification", {
          ...notification.toObject(),
          timeAgo: this.calculateTimeAgo(notification.createdAt),
        });
      }
    } catch (error) {
      console.error("❌ CoreNotification.emitRealTime error:", error);
    }
  }

  /**
   * Get user's unread count
   */
  static async getBadgeCount(userId) {
    return await Notification.countDocuments({ userId, read: false });
  }

  /**
   * Update user's badge count
   */
  static async updateBadgeCount(userId) {
    const unreadCount = await this.getBadgeCount(userId);
    await User.findByIdAndUpdate(userId, {
      notificationBadgeCount: unreadCount,
    });
    return unreadCount;
  }

  /**
   * Get user notifications with pagination
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, unreadOnly = false, type } = options;

      const query = { userId };
      if (unreadOnly) query.read = false;
      if (type) {
        query.type = Array.isArray(type) ? { $in: type } : type;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(query);
      const unreadCount = await this.getBadgeCount(userId);

      // Update last check time
      await User.findByIdAndUpdate(userId, {
        lastNotificationCheck: new Date(),
      });

      // Add timeAgo
      const enriched = notifications.map((n) => ({
        ...n,
        timeAgo: this.calculateTimeAgo(n.createdAt),
      }));

      return {
        notifications: enriched,
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
    } catch (error) {
      console.error("❌ CoreNotification.getUserNotifications error:", error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true },
      );

      if (notification) {
        await this.updateBadgeCount(userId);
        this.emitRealTime(notification);
      }

      return notification;
    } catch (error) {
      console.error("❌ CoreNotification.markAsRead error:", error);
      throw error;
    }
  }

  /**
   * Mark all as read
   */
  static async markAllAsRead(userId) {
    try {
      await Notification.updateMany({ userId, read: false }, { read: true });
      await this.updateBadgeCount(userId);

      if (global.io) {
        global.io
          .to(`user-${userId}`)
          .emit("notifications-read", { all: true });
      }
      return true;
    } catch (error) {
      console.error("❌ CoreNotification.markAllAsRead error:", error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  static async delete(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        userId,
      });

      if (notification) {
        await this.updateBadgeCount(userId);
        if (global.io) {
          global.io
            .to(`user-${userId}`)
            .emit("notification-deleted", { notificationId });
        }
      }

      return notification;
    } catch (error) {
      console.error("❌ CoreNotification.delete error:", error);
      throw error;
    }
  }

  /**
   * Clear expired notifications
   */
  static async clearExpired() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() },
      });
      return result.deletedCount;
    } catch (error) {
      console.error("❌ CoreNotification.clearExpired error:", error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  static async getStats(userId) {
    try {
      const [total, unread, typeStats] = await Promise.all([
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, read: false }),
        Notification.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId) } },
          {
            $group: {
              _id: "$type",
              total: { $sum: 1 },
              unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
            },
          },
        ]),
      ]);

      const byType = {};
      typeStats.forEach((stat) => {
        byType[stat._id] = { total: stat.total, unread: stat.unread };
      });

      return { total, unread, read: total - unread, byType };
    } catch (error) {
      console.error("❌ CoreNotification.getStats error:", error);
      return { total: 0, unread: 0, read: 0, byType: {} };
    }
  }
}

module.exports = CoreNotification;
