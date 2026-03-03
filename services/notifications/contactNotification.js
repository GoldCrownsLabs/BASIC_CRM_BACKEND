// services/notifications/contactNotification.js

const User = require("../../models/User");
const CoreNotification = require("./coreNotification");
const BaseNotification = require("./baseNotification");

/**
 * Contact Notification Module ONLY
 * (Lead methods moved to leadNotification.js)
 */
class ContactNotification extends BaseNotification {
  /**
   * Notify when contact is created
   */
  static async notifyContactCreated(contact, createdBy) {
    try {
      const notifications = [];
      const creator = await User.findById(createdBy);
      if (!creator) return [];

      const contactName = this.getContactFullName(contact);

      // 1. Creator notification
      if (creator.shouldReceiveNotification?.("contact")) {
        notifications.push({
          userId: createdBy,
          title: "Contact Added",
          message: `New contact "${contactName}" added as ${contact.leadStatus || "cold"} lead`,
          type: "contact",
          data: {
            contactId: contact._id,
            contactName,
            action: "created",
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            leadStatus: contact.leadStatus,
          },
        });
      }

      // 2. Team members
      if (creator.department) {
        const teamMembers = await User.find({
          department: creator.department,
          isActive: true,
          _id: { $ne: createdBy },
        });

        for (const member of teamMembers) {
          if (member.shouldReceiveNotification?.("contact")) {
            notifications.push({
              userId: member._id,
              title: "New Team Contact",
              message: `${creator.name} added contact: "${contactName}"`,
              type: "contact",
              data: {
                contactId: contact._id,
                contactName,
                action: "team_contact",
                addedBy: createdBy,
                addedByName: creator.name,
                company: contact.company,
              },
            });
          }
        }
      }

      // 3. Hot lead alert (if contact becomes hot lead)
      if (contact.leadStatus === "hot") {
        const salesTeam = await User.find({
          department: "sales",
          isActive: true,
          _id: { $ne: createdBy },
        });

        for (const salesPerson of salesTeam) {
          notifications.push({
            userId: salesPerson._id,
            title: "🔥 Hot Lead Alert!",
            message: `${creator.name} added a HOT lead: "${contactName}"`,
            type: "contact", // Changed from "lead" to "contact"
            data: {
              contactId: contact._id,
              contactName,
              action: "hot_lead",
              leadStatus: "hot",
            },
          });
        }
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error(
        "❌ ContactNotification.notifyContactCreated error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when contact is connected
   */
  static async notifyContactConnected(contact, userId) {
    try {
      const notifications = [];
      const user = await User.findById(userId);
      if (!user) return [];

      const contactName = this.getContactFullName(contact);

      // 1. User notification
      if (user.shouldReceiveNotification?.("contact")) {
        notifications.push({
          userId,
          title: "📞 Contact Connected!",
          message: `${contactName} has been marked as connected`,
          type: "connected",
          data: {
            contactId: contact._id,
            contactName,
            action: "connected",
            connectedAt: contact.connectedAt,
            company: contact.company,
          },
        });
      }

      // 2. Team members
      if (user.department) {
        const teamMembers = await User.find({
          department: user.department,
          isActive: true,
          _id: { $ne: userId },
        });

        for (const member of teamMembers) {
          if (member.shouldReceiveNotification?.("contact")) {
            notifications.push({
              userId: member._id,
              title: "👥 Team Connected Contact",
              message: `${user.name} connected with ${contactName}`,
              type: "connected",
              data: {
                contactId: contact._id,
                contactName,
                action: "team_connected",
                connectedBy: userId,
                connectedByName: user.name,
              },
            });
          }
        }
      }

      // 3. Managers
      const reportingChain = (await user.getReportingChain?.()) || [];
      for (const manager of reportingChain) {
        notifications.push({
          userId: manager._id,
          title: "📊 Team Connection Update",
          message: `${user.name} connected with ${contactName}`,
          type: "connected",
          data: {
            contactId: contact._id,
            contactName,
            action: "manager_notify",
            connectedBy: userId,
            connectedByName: user.name,
          },
        });
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error(
        "❌ ContactNotification.notifyContactConnected error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when contact is completed (deal)
   */
  static async notifyContactCompleted(contact, userId) {
    try {
      const notifications = [];
      const user = await User.findById(userId);
      if (!user) return [];

      const contactName = this.getContactFullName(contact);
      const formattedAmount = this.formatCurrency(
        contact.dealValue,
        contact.dealCurrency,
      );

      // 1. User notification
      if (user.shouldReceiveNotification?.("contact")) {
        notifications.push({
          userId,
          title: "🎉 Deal Completed!",
          message: `You closed a deal with ${contactName} for ${formattedAmount}!`,
          type: "completed",
          data: {
            contactId: contact._id,
            contactName,
            action: "completed",
            dealValue: contact.dealValue,
            formattedAmount,
            completedAt: contact.completedAt,
            company: contact.company,
          },
        });
      }

      // 2. Team celebration
      if (user.department) {
        const teamMembers = await User.find({
          department: user.department,
          isActive: true,
          _id: { $ne: userId },
        });

        for (const member of teamMembers) {
          notifications.push({
            userId: member._id,
            title: "🎯 Team Deal Closed!",
            message: `${user.name} closed a deal for ${formattedAmount}!`,
            type: "completed",
            data: {
              contactId: contact._id,
              contactName,
              action: "team_completed",
              completedBy: userId,
              completedByName: user.name,
              formattedAmount,
            },
          });
        }
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error(
        "❌ ContactNotification.notifyContactCompleted error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify big deal
   */
  static async notifyBigDeal(contact, userId, threshold = 100000) {
    try {
      if (contact.dealValue < threshold) return [];

      const notifications = [];
      const user = await User.findById(userId);
      const contactName = this.getContactFullName(contact);
      const formattedAmount = this.formatCurrency(contact.dealValue);

      // Notify admins
      const admins = await User.find({
        role: { $in: ["admin", "super_admin", "director"] },
        isActive: true,
      });

      for (const admin of admins) {
        notifications.push({
          userId: admin._id,
          title: "⭐ BIG DEAL ALERT ⭐",
          message: `${user?.name || "Someone"} closed a BIG deal for ${formattedAmount}!`,
          type: "completed",
          data: {
            contactId: contact._id,
            contactName,
            action: "big_deal",
            completedBy: userId,
            completedByName: user?.name,
            dealValue: contact.dealValue,
            formattedAmount,
          },
        });
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error("❌ ContactNotification.notifyBigDeal error:", error);
      throw error;
    }
  }
}

module.exports = ContactNotification;
