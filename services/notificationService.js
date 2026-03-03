const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

// ======================== HELPER FUNCTIONS ========================

/**
 * Get contact full name from firstName and lastName
 */
const getContactFullName = (contact) => {
  if (!contact) return "Unknown Contact";

  const firstName = contact.firstName || contact.first_name || "";
  const lastName = contact.lastName || contact.last_name || "";

  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Contact";
};

/**
 * Get lead full name from firstName and lastName
 */
const getLeadFullName = (lead) => {
  if (!lead) return "Unknown Lead";

  const firstName = lead.firstName || lead.first_name || "";
  const lastName = lead.lastName || lead.last_name || "";

  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Lead";
};

class NotificationService {
  // ======================== CORE METHODS ========================

  /**
   * Create a single notification
   */
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

      // Emit real-time notification via Socket.IO
      this.emitRealTimeNotification(notification);

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Create multiple notifications in bulk
   */
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

  // ======================== PUSH NOTIFICATION METHODS ========================

  /**
   * Send push notification via Expo
   */
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

  /**
   * Get click action based on notification type (for deep linking)
   */
  static getClickAction(type, data) {
    const actions = {
      task: data.taskId ? `app://task/${data.taskId}` : null,
      lead: data.leadId ? `app://lead/${data.leadId}` : null,
      contact: data.contactId ? `app://contact/${data.contactId}` : null,
      profile: data.profileId ? `app://profile/${data.profileId}` : null,
      project: data.projectId ? `app://project/${data.projectId}` : null,
      order: data.orderId ? `app://order/${data.orderId}` : null,
      payment: data.paymentId ? `app://payment/${data.paymentId}` : null,
      attendance: data.attendanceId
        ? `app://attendance/${data.attendanceId}`
        : null,
      leave: data.leaveId ? `app://leave/${data.leaveId}` : null,
    };
    return actions[type] || "app://notifications";
  }

  // ======================== BADGE MANAGEMENT ========================

  /**
   * Get user's unread notification count
   */
  static async getUserBadgeCount(userId) {
    const count = await Notification.countDocuments({
      userId,
      read: false,
    });
    return count;
  }

  /**
   * Update user's badge count in database
   */
  static async updateBadgeCount(userId) {
    const unreadCount = await this.getUserBadgeCount(userId);
    await User.findByIdAndUpdate(userId, {
      notificationBadgeCount: unreadCount,
    });
    return unreadCount;
  }

  // ======================== REAL-TIME NOTIFICATIONS ========================

  /**
   * Emit real-time notification via Socket.IO
   */
  static async emitRealTimeNotification(notification) {
    try {
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

  // ======================== TASK NOTIFICATIONS ========================

  /**
   * Notify when a task is created
   */
  static async notifyTaskCreated(task, createdBy) {
    try {
      const notifications = [];
      const creator = await User.findById(createdBy);

      if (!creator) return [];

      // 1. Notify creator
      if (creator.shouldReceiveNotification("task")) {
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

      // 2. Notify assigned users
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

      // 3. Notify reporting managers
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

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyTaskCreated:", error);
      throw error;
    }
  }

  /**
   * Notify when a task is updated
   */
  static async notifyTaskUpdated(task, updatedBy, changes) {
    try {
      const notifications = [];
      const updater = await User.findById(updatedBy);

      if (!updater) return [];

      // Notify assigned users
      if (task.assignedTo && task.assignedTo.length > 0) {
        const assignedUsers = await User.find({
          _id: { $in: task.assignedTo },
          isActive: true,
        });

        for (const user of assignedUsers) {
          if (user.shouldReceiveNotification("task")) {
            notifications.push({
              userId: user._id,
              title: "Task Updated",
              message: `Task "${task.title}" has been updated by ${updater.name}`,
              type: "task",
              data: {
                taskId: task._id,
                action: "updated",
                updatedBy: updatedBy,
                updaterName: updater.name,
                changes: changes,
              },
            });
          }
        }
      }

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyTaskUpdated:", error);
      throw error;
    }
  }

  /**
   * Notify when a task is completed
   */
  static async notifyTaskCompleted(task, completedBy) {
    try {
      const notifications = [];
      const completer = await User.findById(completedBy);

      if (!completer) return [];

      // Notify task creator
      if (
        task.createdBy &&
        task.createdBy.toString() !== completedBy.toString()
      ) {
        const creator = await User.findById(task.createdBy);
        if (creator && creator.shouldReceiveNotification("task")) {
          notifications.push({
            userId: task.createdBy,
            title: "Task Completed",
            message: `Task "${task.title}" has been completed by ${completer.name}`,
            type: "task",
            data: {
              taskId: task._id,
              action: "completed",
              completedBy: completedBy,
              completerName: completer.name,
            },
          });
        }
      }

      // Notify project manager
      if (task.projectId) {
        // Find project manager logic here
      }

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyTaskCompleted:", error);
      throw error;
    }
  }

  // ======================== LEAD NOTIFICATIONS ========================

  /**
   * Notify when a lead is created
   */
  static async notifyLeadCreated(lead, createdBy) {
    try {
      const notifications = [];
      const creator = await User.findById(createdBy);

      if (!creator) return [];

      // ✅ FIX: Get lead full name
      const leadName = getLeadFullName(lead);

      // 1. Notify creator
      if (creator.shouldReceiveNotification("lead")) {
        notifications.push({
          userId: createdBy,
          title: `New Lead: ${leadName}`,
          message: `Lead "${leadName}" has been created successfully`,
          type: "lead",
          data: {
            leadId: lead._id,
            leadName: leadName,
            action: "created",
            source: lead.source,
            status: lead.status,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
          },
        });
      }

      // 2. Notify assigned sales person
      if (lead.assignedTo) {
        const assignedUser = await User.findById(lead.assignedTo);
        if (
          assignedUser &&
          assignedUser._id.toString() !== createdBy.toString() &&
          assignedUser.shouldReceiveNotification("lead")
        ) {
          notifications.push({
            userId: lead.assignedTo,
            title: `New Lead Assigned: ${leadName}`,
            message: `Lead "${leadName}" has been assigned to you`,
            type: "lead",
            data: {
              leadId: lead._id,
              leadName: leadName,
              action: "assigned",
              assignedBy: createdBy,
              leadValue: lead.value,
            },
          });
        }
      }

      // 3. Notify sales managers
      const salesManagers = await User.find({
        role: { $in: ["manager", "supervisor"] },
        department: "sales",
        isActive: true,
      });

      for (const manager of salesManagers) {
        if (manager.shouldReceiveNotification("lead")) {
          notifications.push({
            userId: manager._id,
            title: `New Lead in System: ${leadName}`,
            message: `${creator.name} added new lead "${leadName}" from ${lead.company || "Unknown"}`,
            type: "lead",
            data: {
              leadId: lead._id,
              leadName: leadName,
              action: "manager_notify",
              createdBy: createdBy,
              creatorName: creator?.name,
            },
          });
        }
      }

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyLeadCreated:", error);
      throw error;
    }
  }

  /**
   * Notify when lead status changes
   */
  static async notifyLeadStatusChanged(lead, oldStatus, newStatus, changedBy) {
    try {
      const notifications = [];
      const changer = await User.findById(changedBy);

      if (!changer) return [];

      // ✅ FIX: Get lead full name
      const leadName = getLeadFullName(lead);

      // Notify assigned sales person
      if (lead.assignedTo) {
        const assignedUser = await User.findById(lead.assignedTo);
        if (assignedUser && assignedUser.shouldReceiveNotification("lead")) {
          notifications.push({
            userId: lead.assignedTo,
            title: `Lead Status Updated: ${leadName}`,
            message: `Lead "${leadName}" status changed from ${oldStatus} to ${newStatus}`,
            type: "lead",
            data: {
              leadId: lead._id,
              leadName: leadName,
              action: "status_changed",
              oldStatus: oldStatus,
              newStatus: newStatus,
              changedBy: changedBy,
              changerName: changer.name,
            },
          });
        }
      }

      // Also notify the creator if different from assigned person
      if (
        lead.createdBy &&
        lead.createdBy.toString() !== lead.assignedTo?.toString()
      ) {
        const creator = await User.findById(lead.createdBy);
        if (creator && creator.shouldReceiveNotification("lead")) {
          notifications.push({
            userId: lead.createdBy,
            title: `Lead Status Updated: ${leadName}`,
            message: `Lead "${leadName}" status changed from ${oldStatus} to ${newStatus} by ${changer.name}`,
            type: "lead",
            data: {
              leadId: lead._id,
              leadName: leadName,
              action: "status_changed_creator",
              oldStatus: oldStatus,
              newStatus: newStatus,
              changedBy: changedBy,
              changerName: changer.name,
            },
          });
        }
      }

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyLeadStatusChanged:", error);
      throw error;
    }
  }

  // ======================== CONTACT NOTIFICATIONS ========================

  /**
   * Notify when a contact is created
   */
  static async notifyContactCreated(contact, createdBy) {
    try {
      const notifications = [];
      const creator = await User.findById(createdBy);

      if (!creator) return [];

      // ✅ FIX: Get contact full name
      const contactName = getContactFullName(contact);

      // 1. Creator ko notification
      if (creator.shouldReceiveNotification("contact")) {
        notifications.push({
          userId: createdBy,
          title: "Contact Added",
          message: `New contact "${contactName}" has been added successfully`,
          type: "contact",
          data: {
            contactId: contact._id,
            contactName: contactName,
            action: "created",
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
          },
        });
      }

      // 2. Team members ko notification (same department)
      if (creator.department) {
        const teamMembers = await User.find({
          department: creator.department,
          isActive: true,
          _id: { $ne: createdBy },
        });

        for (const member of teamMembers) {
          if (member.shouldReceiveNotification("contact")) {
            notifications.push({
              userId: member._id,
              title: "New Team Contact",
              message: `${creator.name} added contact: "${contactName}"`,
              type: "contact",
              data: {
                contactId: contact._id,
                contactName: contactName,
                action: "team_contact",
                addedBy: createdBy,
                addedByName: creator.name,
                company: contact.company,
              },
            });
          }
        }
      }

      // 3. Reporting managers ko notification
      const reportingChain = await creator.getReportingChain();
      for (const manager of reportingChain) {
        if (manager.shouldReceiveNotification("contact")) {
          notifications.push({
            userId: manager._id,
            title: "Team Contact Added",
            message: `${creator.name} added new contact: "${contactName}" from ${contact.company || "Unknown"}`,
            type: "contact",
            data: {
              contactId: contact._id,
              contactName: contactName,
              action: "manager_notify",
              addedBy: createdBy,
              creatorName: creator.name,
            },
          });
        }
      }

      // 4. Sales team ko notify agar lead hai (optional)
      if (contact.isLead || contact.convertToLead) {
        const salesTeam = await User.find({
          department: "sales",
          isActive: true,
          _id: { $ne: createdBy },
        });

        for (const salesPerson of salesTeam) {
          if (salesPerson.shouldReceiveNotification("contact")) {
            notifications.push({
              userId: salesPerson._id,
              title: "New Lead from Contact",
              message: `Contact "${contactName}" can be converted to lead`,
              type: "contact",
              data: {
                contactId: contact._id,
                contactName: contactName,
                action: "potential_lead",
                addedBy: createdBy,
                email: contact.email,
                phone: contact.phone,
              },
            });
          }
        }
      }

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyContactCreated:", error);
      throw error;
    }
  }

  // ======================== PROFILE NOTIFICATIONS ========================

  /**
   * Notify when a profile is created (user registration)
   */
  static async notifyProfileCreated(newUser, createdBy = null) {
    try {
      const notifications = [];

      // Agar admin ya manager ne profile banayi hai
      if (createdBy && createdBy !== newUser._id.toString()) {
        const creator = await User.findById(createdBy);

        if (!creator) return [];

        // 1. Naye user ko welcome notification
        notifications.push({
          userId: newUser._id,
          title: "🎉 Welcome to the Team!",
          message: `Hello ${newUser.name}, your profile has been created. Get started by completing your profile!`,
          type: "profile",
          data: {
            profileId: newUser._id,
            action: "welcome",
            role: newUser.role,
            department: newUser.department,
          },
        });

        // 2. Creator ko confirmation
        if (creator.shouldReceiveNotification("profile")) {
          notifications.push({
            userId: createdBy,
            title: "Profile Created Successfully",
            message: `New profile created for ${newUser.name} (${newUser.role})`,
            type: "profile",
            data: {
              profileId: newUser._id,
              action: "created",
              userEmail: newUser.email,
              userRole: newUser.role,
              userDepartment: newUser.department,
            },
          });
        }

        // 3. HR/Admin team ko notification (sabhi admins ko)
        const admins = await User.find({
          role: { $in: ["admin", "hr_manager", "super_admin"] },
          isActive: true,
          _id: { $ne: createdBy },
        });

        for (const admin of admins) {
          if (admin.shouldReceiveNotification("profile")) {
            notifications.push({
              userId: admin._id,
              title: "New User Registration",
              message: `${newUser.name} joined as ${newUser.role} in ${newUser.department || "General"}`,
              type: "profile",
              data: {
                profileId: newUser._id,
                action: "new_user",
                createdBy: createdBy,
                creatorName: creator.name,
                userEmail: newUser.email,
              },
            });
          }
        }

        // 4. Department head ko notification
        if (newUser.department) {
          const deptHead = await User.findOne({
            department: newUser.department,
            role: { $in: ["manager", "head"] },
            isActive: true,
          });

          if (deptHead && deptHead._id.toString() !== createdBy.toString()) {
            if (deptHead.shouldReceiveNotification("profile")) {
              notifications.push({
                userId: deptHead._id,
                title: "New Team Member",
                message: `${newUser.name} has joined your ${newUser.department} department`,
                type: "profile",
                data: {
                  profileId: newUser._id,
                  action: "department_join",
                  userRole: newUser.role,
                  createdBy: createdBy,
                },
              });
            }
          }
        }
      } else {
        // Self-registration (user ne khud register kiya)

        // 1. User ko welcome notification
        notifications.push({
          userId: newUser._id,
          title: "🎉 Welcome Aboard!",
          message: `Hi ${newUser.name}, thank you for joining! Complete your profile to get started.`,
          type: "profile",
          data: {
            profileId: newUser._id,
            action: "self_registration",
          },
        });

        // 2. Admins ko notify about new self-registration
        const admins = await User.find({
          role: { $in: ["admin", "hr_manager", "super_admin"] },
          isActive: true,
        });

        for (const admin of admins) {
          if (admin.shouldReceiveNotification("profile")) {
            notifications.push({
              userId: admin._id,
              title: "New User Self-Registration",
              message: `${newUser.name} (${newUser.email}) just joined the platform`,
              type: "profile",
              data: {
                profileId: newUser._id,
                action: "new_registration",
                userEmail: newUser.email,
                userRole: newUser.role || "Not specified",
              },
            });
          }
        }
      }

      if (notifications.length === 0) return [];

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyProfileCreated:", error);
      throw error;
    }
  }

  /**
   * Notify when profile is updated
   */
  static async notifyProfileUpdated(userId, updatedBy, changes) {
    try {
      const user = await User.findById(userId);
      const updater = await User.findById(updatedBy);

      if (!user || !updater) return null;

      // Khud ke profile update pe notification mat bhejo
      if (userId.toString() === updatedBy.toString()) {
        return null;
      }

      const notifications = [];

      // User ko notify karo ki unka profile update hua
      notifications.push({
        userId: userId,
        title: "Profile Updated",
        message: `Your profile was updated by ${updater.name}`,
        type: "profile",
        data: {
          profileId: userId,
          action: "updated_by_admin",
          updatedBy: updatedBy,
          updaterName: updater.name,
          changes: changes,
        },
      });

      // Admin ko confirmation
      if (updater.shouldReceiveNotification("profile")) {
        notifications.push({
          userId: updatedBy,
          title: "Profile Update Success",
          message: `You have updated ${user.name}'s profile`,
          type: "profile",
          data: {
            profileId: userId,
            action: "update_success",
            userName: user.name,
            changes: changes,
          },
        });
      }

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in notifyProfileUpdated:", error);
      throw error;
    }
  }

  // ======================== ORDER & PAYMENT NOTIFICATIONS ========================

  /**
   * Notify when order is created
   */
  static async notifyOrderCreated(order, userId) {
    try {
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
    } catch (error) {
      console.error("Error in notifyOrderCreated:", error);
      throw error;
    }
  }

  /**
   * Notify when payment is received
   */
  static async notifyPaymentReceived(payment, userId) {
    try {
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
    } catch (error) {
      console.error("Error in notifyPaymentReceived:", error);
      throw error;
    }
  }

  // ======================== SYSTEM NOTIFICATIONS ========================

  /**
   * Send system notification
   */
  static async sendSystemNotification(userId, title, message, data = {}) {
    try {
      return await this.createNotification({
        userId,
        title,
        message,
        type: "system",
        data,
      });
    } catch (error) {
      console.error("Error in sendSystemNotification:", error);
      throw error;
    }
  }

  /**
   * Broadcast system notification to all users
   */
  static async broadcastSystemNotification(
    title,
    message,
    data = {},
    userFilter = {},
  ) {
    try {
      const users = await User.find({ isActive: true, ...userFilter }).select(
        "_id",
      );

      const notifications = users.map((user) => ({
        userId: user._id,
        title,
        message,
        type: "system",
        data,
      }));

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("Error in broadcastSystemNotification:", error);
      throw error;
    }
  }

  // ======================== NOTIFICATION MANAGEMENT ========================

  /**
   * Get user notifications with pagination
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, unreadOnly = false, type } = options;

      const query = { userId };
      if (unreadOnly) query.read = false;
      if (type) query.type = type;

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
    } catch (error) {
      console.error("Error in getUserNotifications:", error);
      throw error;
    }
  }

  /**
   * Calculate time ago string
   */
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

  /**
   * Mark a notification as read
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
        await this.emitRealTimeNotification(notification);
      }

      return notification;
    } catch (error) {
      console.error("Error in markAsRead:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    try {
      await Notification.updateMany({ userId, read: false }, { read: true });

      await this.updateBadgeCount(userId);

      // Emit update via socket
      if (global.io) {
        global.io
          .to(`user-${userId}`)
          .emit("notifications-read", { all: true });
      }

      return true;
    } catch (error) {
      console.error("Error in markAllAsRead:", error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId, userId) {
    try {
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
    } catch (error) {
      console.error("Error in deleteNotification:", error);
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
      console.error("Error in clearExpired:", error);
      throw error;
    }
  }

  // ======================== STATISTICS ========================

  /**
   * Get notification statistics for a user
   */
  static async getNotificationStats(userId) {
    try {
      const [total, unread] = await Promise.all([
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, read: false }),
      ]);

      // Get counts by type
      const typeStats = await Notification.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
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
      console.error("Error in getNotificationStats:", error);
      return { total: 0, unread: 0, read: 0, byType: {} };
    }
  }
}

module.exports = NotificationService;