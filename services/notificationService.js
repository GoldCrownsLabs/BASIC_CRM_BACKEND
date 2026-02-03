// services/notificationService.js (NEW FILE CREATE KAREN)
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

      // Send push notification if user has token and enabled
      if (notificationData.userId && notificationData.sendPush !== false) {
        await this.sendPushNotification(notification);
      }

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

      if (
        !user ||
        !user.pushToken ||
        !user.notificationSettings?.pushNotifications
      ) {
        return null;
      }

      if (!Expo.isExpoPushToken(user.pushToken)) {
        console.warn(`Invalid push token for user ${user._id}`);
        return null;
      }

      const message = {
        to: user.pushToken,
        sound: "default",
        title: notification.title,
        body: notification.message,
        data: {
          type: notification.type,
          ...notification.data,
          notificationId: notification._id.toString(),
        },
        // Optional: Customize for iOS/Android
        ...(process.env.NODE_ENV === "production" && {
          priority: "high",
          ttl: 60 * 60 * 24, // 24 hours
        }),
      };

      const ticket = await expo.sendPushNotificationsAsync([message]);

      // Update notification as push sent
      notification.pushSent = true;
      notification.pushToken = user.pushToken;
      await notification.save();

      // Also update user's badge count
      await User.findByIdAndUpdate(user._id, {
        $inc: { notificationBadgeCount: 1 },
      });

      return ticket;
    } catch (error) {
      console.error("Error sending push notification:", error);
      return null;
    }
  }

  // Bulk create notifications
  static async createBulkNotifications(notificationsData) {
    try {
      const notifications = await Notification.insertMany(notificationsData);

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

  // Task created notification (updated for your User model)
  static async notifyTaskCreated(task, createdBy) {
    const notifications = [];
    const creator = await User.findById(createdBy);

    // Notify creator
    if (creator && creator.notificationSettings?.taskNotifications) {
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
        "notificationSettings.taskNotifications": true,
      });

      for (const user of assignedUsers) {
        if (user._id.toString() !== createdBy.toString()) {
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
        if (manager.notificationSettings?.taskNotifications) {
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

  // Lead created notification (updated)
  static async notifyLeadCreated(lead, createdBy) {
    const notifications = [];
    const creator = await User.findById(createdBy);

    // Notify creator
    if (creator && creator.notificationSettings?.leadNotifications) {
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
        assignedUser.notificationSettings?.leadNotifications
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
      "notificationSettings.leadNotifications": true,
      isActive: true,
    });

    for (const manager of salesManagers) {
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

    return await this.createBulkNotifications(notifications);
  }

  // User-specific notifications (for your User model)
  static async notifyUserUpdate(userId, updateType, data) {
    const user = await User.findById(userId);
    if (!user || !user.notificationSettings?.inAppNotifications) return null;

    const messages = {
      profile_updated: "Your profile has been updated",
      password_changed: "Your password has been changed successfully",
      login_new_device: "New login detected on your account",
      order_placed: "Your order has been placed successfully",
      payment_received: "Payment received for your order",
    };

    return await this.createNotification({
      userId,
      title: "Account Update",
      message: messages[updateType] || "Your account has been updated",
      type: "system",
      data: { updateType, ...data },
    });
  }

  // Get user notifications
  static async getUserNotifications(userId, options = {}) {
    const { limit = 20, skip = 0, unreadOnly = false } = options;

    const query = { userId };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    // Update badge count
    await User.findByIdAndUpdate(userId, {
      notificationBadgeCount: unreadCount,
      lastNotificationCheck: new Date(),
    });

    return {
      notifications,
      pagination: {
        total,
        limit,
        skip,
        hasMore: total > skip + limit,
      },
      unreadCount,
    };
  }

  // Mark as read
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true },
    );

    if (notification) {
      // Update user badge count
      const unreadCount = await Notification.countDocuments({
        userId,
        read: false,
      });
      await User.findByIdAndUpdate(userId, {
        notificationBadgeCount: unreadCount,
      });
    }

    return notification;
  }

  // Mark all as read
  static async markAllAsRead(userId) {
    await Notification.updateMany({ userId, read: false }, { read: true });

    // Reset badge count
    await User.findByIdAndUpdate(userId, {
      notificationBadgeCount: 0,
    });

    return true;
  }

  // Clear expired notifications
  static async clearExpired() {
    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  }
}

module.exports = NotificationService;
