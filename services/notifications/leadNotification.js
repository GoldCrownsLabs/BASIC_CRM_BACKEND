// services/notifications/leadNotification.js

const User = require("../../models/User");
const CoreNotification = require("./coreNotification");
const BaseNotification = require("./baseNotification");

/**
 * Lead Notification Module
 * Handles all lead-related notifications:
 * - Lead creation
 * - Lead assignment
 * - Lead status changes
 * - Lead priority alerts
 * - Lead conversion
 */
class LeadNotification extends BaseNotification {
  /**
   * Notify when lead is created
   */
  static async notifyLeadCreated(lead, createdBy) {
    try {
      const notifications = [];
      const creator = await User.findById(createdBy);
      if (!creator) return [];

      const leadName = this.getLeadFullName(lead);
      const priorityEmoji = this.getPriorityEmoji(lead.priority);
      const formattedBudget = this.formatCurrency(lead.budget);

      // 1. Creator notification
      if (creator.shouldReceiveNotification?.("lead")) {
        notifications.push({
          userId: createdBy,
          title: "📋 New Lead Created",
          message: `Lead "${leadName}" created with ${priorityEmoji} ${lead.priority || "medium"} priority`,
          type: "lead",
          data: {
            leadId: lead._id,
            leadName,
            action: "created",
            source: lead.source,
            status: lead.status,
            priority: lead.priority,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            budget: lead.budget,
            formattedBudget,
          },
        });
      }

      // 2. Assigned person notification
      if (
        lead.assignedTo &&
        lead.assignedTo.toString() !== createdBy.toString()
      ) {
        const assignedUser = await User.findById(lead.assignedTo);
        if (assignedUser?.shouldReceiveNotification?.("lead")) {
          notifications.push({
            userId: lead.assignedTo,
            title: "📋 New Lead Assigned",
            message: `Lead "${leadName}" assigned to you by ${creator.name}`,
            type: "lead",
            data: {
              leadId: lead._id,
              leadName,
              action: "assigned",
              assignedBy: createdBy,
              assignedByName: creator.name,
              priority: lead.priority,
              budget: lead.budget,
              formattedBudget,
            },
          });
        }
      }

      // 3. Team members notification
      if (creator.department) {
        const teamMembers = await User.find({
          department: creator.department,
          isActive: true,
          _id: { $nin: [createdBy, lead.assignedTo].filter(Boolean) },
        });

        for (const member of teamMembers) {
          if (member.shouldReceiveNotification?.("lead")) {
            notifications.push({
              userId: member._id,
              title: "👥 Team Lead Added",
              message: `${creator.name} added new lead: "${leadName}"`,
              type: "lead",
              data: {
                leadId: lead._id,
                leadName,
                action: "team_lead",
                addedBy: createdBy,
                addedByName: creator.name,
                company: lead.company,
              },
            });
          }
        }
      }

      // 4. High priority alert
      if (lead.priority === "high" || lead.priority === "urgent") {
        await this._sendHighPriorityAlert(lead, creator, notifications);
      }

      // 5. High value alert
      if (lead.budget && lead.budget >= 100000) {
        await this._sendHighValueAlert(lead, creator, notifications);
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error("❌ LeadNotification.notifyLeadCreated error:", error);
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

      const leadName = this.getLeadFullName(lead);
      const fromEmoji = this.getStatusEmoji(oldStatus);
      const toEmoji = this.getStatusEmoji(newStatus);

      // 1. Notify assigned person
      if (lead.assignedTo) {
        notifications.push({
          userId: lead.assignedTo,
          title: `🔄 Lead Status Updated: ${leadName}`,
          message: `Status changed from ${fromEmoji} ${oldStatus} to ${toEmoji} ${newStatus}`,
          type: "lead",
          data: {
            leadId: lead._id,
            leadName,
            action: "status_changed",
            oldStatus,
            newStatus,
            changedBy,
            changerName: changer.name,
          },
        });
      }

      // 2. Notify creator if different
      if (
        lead.createdBy &&
        lead.createdBy.toString() !== lead.assignedTo?.toString()
      ) {
        notifications.push({
          userId: lead.createdBy,
          title: `🔄 Lead Status Updated: ${leadName}`,
          message: `Status changed from ${oldStatus} to ${newStatus} by ${changer.name}`,
          type: "lead",
          data: {
            leadId: lead._id,
            leadName,
            action: "status_changed_creator",
            oldStatus,
            newStatus,
            changedBy,
            changerName: changer.name,
          },
        });
      }

      // 3. Special status alerts
      if (newStatus === "hot" || newStatus === "qualified") {
        await this._sendHotLeadAlert(lead, changer, notifications);
      }

      if (newStatus === "converted" || newStatus === "won") {
        await this._sendLeadConvertedAlert(lead, changer, notifications);
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error(
        "❌ LeadNotification.notifyLeadStatusChanged error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when lead is assigned
   */
  static async notifyLeadAssigned(lead, assignedBy) {
    try {
      if (!lead.assignedTo) return [];

      const assigner = await User.findById(assignedBy);
      if (!assigner) return [];

      const leadName = this.getLeadFullName(lead);
      const assignedUser = await User.findById(lead.assignedTo);

      if (!assignedUser?.shouldReceiveNotification?.("lead")) return [];

      const notification = {
        userId: lead.assignedTo,
        title: "📋 Lead Assigned to You",
        message: `Lead "${leadName}" has been assigned to you by ${assigner.name}`,
        type: "lead",
        data: {
          leadId: lead._id,
          leadName,
          action: "assigned",
          assignedBy,
          assignerName: assigner.name,
          priority: lead.priority,
          budget: lead.budget,
        },
      };

      return await CoreNotification.create(notification);
    } catch (error) {
      console.error("❌ LeadNotification.notifyLeadAssigned error:", error);
      throw error;
    }
  }

  /**
   * Notify when lead is converted to customer/deal
   */
  static async notifyLeadConverted(lead, convertedBy, dealValue) {
    try {
      const notifications = [];
      const converter = await User.findById(convertedBy);
      if (!converter) return [];

      const leadName = this.getLeadFullName(lead);
      const formattedAmount = this.formatCurrency(dealValue || lead.budget);

      // 1. Converter notification
      if (converter.shouldReceiveNotification?.("lead")) {
        notifications.push({
          userId: convertedBy,
          title: "🎯 Lead Converted!",
          message: `Lead "${leadName}" converted to deal for ${formattedAmount}!`,
          type: "lead",
          data: {
            leadId: lead._id,
            leadName,
            action: "converted",
            dealValue: dealValue || lead.budget,
            formattedAmount,
            convertedBy,
          },
        });
      }

      // 2. Team celebration
      if (converter.department) {
        const teamMembers = await User.find({
          department: converter.department,
          isActive: true,
          _id: { $ne: convertedBy },
        });

        for (const member of teamMembers) {
          notifications.push({
            userId: member._id,
            title: "🎯 Team Lead Converted!",
            message: `${converter.name} converted "${leadName}" for ${formattedAmount}!`,
            type: "lead",
            data: {
              leadId: lead._id,
              leadName,
              action: "team_converted",
              convertedBy,
              converterName: converter.name,
              formattedAmount,
            },
          });
        }
      }

      // 3. Managers notification
      const managers = await User.find({
        role: { $in: ["manager", "admin"] },
        isActive: true,
        _id: { $ne: convertedBy },
      });

      for (const manager of managers) {
        notifications.push({
          userId: manager._id,
          title: "📊 Lead Conversion Update",
          message: `${converter.name} converted "${leadName}" for ${formattedAmount}`,
          type: "lead",
          data: {
            leadId: lead._id,
            leadName,
            action: "manager_converted",
            convertedBy,
            converterName: converter.name,
            formattedAmount,
          },
        });
      }

      return notifications.length
        ? await CoreNotification.createBulk(notifications)
        : [];
    } catch (error) {
      console.error("❌ LeadNotification.notifyLeadConverted error:", error);
      throw error;
    }
  }

  /**
   * Notify when lead score changes
   */
  static async notifyLeadScoreChanged(lead, oldScore, newScore) {
    try {
      if (!lead.assignedTo) return [];

      const notification = {
        userId: lead.assignedTo,
        title: "📊 Lead Score Updated",
        message: `Lead "${this.getLeadFullName(lead)}" score changed from ${oldScore} to ${newScore}`,
        type: "lead",
        data: {
          leadId: lead._id,
          leadName: this.getLeadFullName(lead),
          action: "score_changed",
          oldScore,
          newScore,
        },
      };

      return await CoreNotification.create(notification);
    } catch (error) {
      console.error("❌ LeadNotification.notifyLeadScoreChanged error:", error);
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Get priority emoji
   */
  static getPriorityEmoji(priority) {
    const emojis = {
      low: "🟢",
      medium: "🟡",
      high: "🔴",
      urgent: "⚡",
    };
    return emojis[priority] || "🟡";
  }

  /**
   * Send high priority alert
   */
  static async _sendHighPriorityAlert(lead, creator, notifications) {
    const salesTeam = await User.find({
      department: "sales",
      isActive: true,
      _id: { $nin: [creator._id, lead.assignedTo].filter(Boolean) },
    });

    for (const salesPerson of salesTeam) {
      notifications.push({
        userId: salesPerson._id,
        title: `⚠️ ${lead.priority.toUpperCase()} PRIORITY LEAD`,
        message: `${creator.name} added a ${lead.priority} priority lead: "${this.getLeadFullName(lead)}"`,
        type: "lead",
        data: {
          leadId: lead._id,
          leadName: this.getLeadFullName(lead),
          action: "high_priority",
          priority: lead.priority,
          budget: lead.budget,
        },
      });
    }
  }

  /**
   * Send high value alert
   */
  static async _sendHighValueAlert(lead, creator, notifications) {
    const admins = await User.find({
      role: { $in: ["admin", "director"] },
      isActive: true,
    });

    const formattedBudget = this.formatCurrency(lead.budget);

    for (const admin of admins) {
      notifications.push({
        userId: admin._id,
        title: "💰 High-Value Lead",
        message: `${creator.name} added a lead with budget ${formattedBudget}`,
        type: "lead",
        data: {
          leadId: lead._id,
          leadName: this.getLeadFullName(lead),
          action: "high_value",
          budget: lead.budget,
          formattedBudget,
          createdBy: creator._id,
        },
      });
    }
  }

  /**
   * Send hot lead alert
   */
  static async _sendHotLeadAlert(lead, changer, notifications) {
    const salesTeam = await User.find({
      department: "sales",
      isActive: true,
      _id: { $nin: [changer._id, lead.assignedTo].filter(Boolean) },
    });

    for (const salesPerson of salesTeam) {
      notifications.push({
        userId: salesPerson._id,
        title: "🔥 HOT LEAD ALERT",
        message: `Lead "${this.getLeadFullName(lead)}" marked as HOT by ${changer.name}`,
        type: "lead",
        data: {
          leadId: lead._id,
          leadName: this.getLeadFullName(lead),
          action: "hot_lead",
          changedBy: changer._id,
          changerName: changer.name,
        },
      });
    }
  }

  /**
   * Send lead converted alert
   */
  static async _sendLeadConvertedAlert(lead, converter, notifications) {
    const formattedBudget = this.formatCurrency(lead.budget);

    const admins = await User.find({
      role: { $in: ["admin", "director"] },
      isActive: true,
      _id: { $ne: converter._id },
    });

    for (const admin of admins) {
      notifications.push({
        userId: admin._id,
        title: "🎯 Lead Converted to Deal",
        message: `${converter.name} converted "${this.getLeadFullName(lead)}" for ${formattedBudget}`,
        type: "lead",
        data: {
          leadId: lead._id,
          leadName: this.getLeadFullName(lead),
          action: "converted_admin",
          convertedBy: converter._id,
          converterName: converter.name,
          formattedBudget,
        },
      });
    }
  }
}

module.exports = LeadNotification;
