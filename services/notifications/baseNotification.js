// services/notifications/baseNotification.js

const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

/**
 * Base Notification Class - Common methods for all notification modules
 */
class BaseNotification {
  /**
   * Helper: Get full name from contact
   */
  static getContactFullName(contact) {
    if (!contact) return "Unknown Contact";
    const firstName = contact.firstName || contact.first_name || "";
    const lastName = contact.lastName || contact.last_name || "";
    return [firstName, lastName].filter(Boolean).join(" ").trim() || "Contact";
  }

  /**
   * Helper: Get full name from lead
   */
  static getLeadFullName(lead) {
    if (!lead) return "Unknown Lead";
    const firstName = lead.firstName || lead.first_name || "";
    const lastName = lead.lastName || lead.last_name || "";
    return [firstName, lastName].filter(Boolean).join(" ").trim() || "Lead";
  }

  /**
   * Helper: Get full name from user
   */
  static getUserFullName(user) {
    if (!user) return "Unknown User";
    return (
      user.name ||
      user.fullName ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "User"
    );
  }

  /**
   * Helper: Format currency
   */
  static formatCurrency(amount, currency = "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  /**
   * Helper: Calculate time ago
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
   * Helper: Get emoji for status
   */
  static getStatusEmoji(status) {
    const emojis = {
      // Lead status
      cold: "❄️",
      warm: "🌤️",
      hot: "🔥",
      connected: "📞",
      completed: "✅",

      // Task status
      pending: "⏳",
      "in-progress": "🔄",
      completed: "✅",
      cancelled: "❌",

      // Priority
      low: "🟢",
      medium: "🟡",
      high: "🔴",
      urgent: "⚡",

      // Default
      default: "📌",
    };
    return emojis[status] || emojis.default;
  }

  /**
   * Helper: Get click action for deep linking
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
      connected: data.contactId ? `app://contact/${data.contactId}` : null,
      completed: data.contactId ? `app://contact/${data.contactId}` : null,
      performance: data.userId ? `app://performance/${data.userId}` : null,
      milestone: data.userId ? `app://milestone/${data.userId}` : null,
    };
    return actions[type] || "app://notifications";
  }
}

module.exports = BaseNotification;
