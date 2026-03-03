// services/notifications/performanceNotification.js

const User = require("../../models/User");
const CoreNotification = require("./coreNotification");
const BaseNotification = require("./baseNotification");

/**
 * Performance & Milestone Notification Module
 */
class PerformanceNotification extends BaseNotification {
  /**
   * Notify performance milestone
   */
  static async notifyMilestone(userId, milestone, stats) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      let title = "",
        message = "";
      const formattedRevenue = this.formatCurrency(stats.totalRevenue || 0);

      switch (milestone) {
        case "first_deal":
          title = "🎯 First Deal Closed!";
          message = `Congratulations! You've closed your first deal for ${this.formatCurrency(stats.dealValue)}!`;
          break;
        case "five_deals":
          title = "🌟 5 Deals Milestone!";
          message = `Amazing! You've closed 5 deals totaling ${formattedRevenue}!`;
          break;
        case "ten_deals":
          title = "💫 Double Digits! 10 Deals Closed";
          message = `Outstanding! You've reached 10 deals with total revenue of ${formattedRevenue}!`;
          break;
        case "revenue_lakh":
          title = "💰 ₹1 Lakh Revenue!";
          message = `Fantastic! You've generated over ₹1 Lakh in revenue!`;
          break;
        case "revenue_crore":
          title = "🎉 ₹1 Crore Revenue! You're a Star!";
          message = `Incredible achievement! You've crossed ₹1 Crore in revenue! 🏆`;
          break;
        default:
          return [];
      }

      const notification = {
        userId,
        title,
        message,
        type: "performance",
        data: {
          milestone,
          ...stats,
          formattedRevenue,
          action: "milestone_achieved",
        },
      };

      return await CoreNotification.create(notification);
    } catch (error) {
      console.error("❌ PerformanceNotification.notifyMilestone error:", error);
      throw error;
    }
  }

  /**
   * Send weekly performance summary
   */
  static async sendWeeklySummary(userId, stats) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.shouldReceiveNotification?.("performance"))
        return null;

      const totalRevenue = this.formatCurrency(stats.weeklyRevenue || 0);
      const avgDeal = this.formatCurrency(stats.averageDealValue || 0);

      const message = `
        📊 Weekly Performance:
        • New: ${stats.newContacts || 0}
        • Connected: ${stats.connected || 0}
        • Deals: ${stats.completed || 0}
        • Revenue: ${totalRevenue}
        • Avg Deal: ${avgDeal}
        • Conversion: ${stats.conversionRate || 0}%
      `
        .replace(/\s+/g, " ")
        .trim();

      return await CoreNotification.create({
        userId,
        title: "📈 Weekly Performance Summary",
        message,
        type: "performance",
        data: {
          action: "weekly_summary",
          ...stats,
          formattedRevenue: totalRevenue,
          formattedAvgDeal: avgDeal,
        },
      });
    } catch (error) {
      console.error(
        "❌ PerformanceNotification.sendWeeklySummary error:",
        error,
      );
      throw error;
    }
  }
}

module.exports = PerformanceNotification;
