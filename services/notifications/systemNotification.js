// services/notifications/systemNotification.js

const User = require("../../models/User");
const CoreNotification = require("./coreNotification");

/**
 * System Notification Module
 */
class SystemNotification {
  /**
   * Send system notification to single user
   */
  static async sendToUser(userId, title, message, data = {}) {
    try {
      return await CoreNotification.create({
        userId,
        title,
        message,
        type: "system",
        data,
      });
    } catch (error) {
      console.error("❌ SystemNotification.sendToUser error:", error);
      throw error;
    }
  }

  /**
   * Broadcast to all users
   */
  static async broadcast(title, message, data = {}, filter = {}) {
    try {
      const users = await User.find({ isActive: true, ...filter }).select(
        "_id",
      );

      const notifications = users.map((user) => ({
        userId: user._id,
        title,
        message,
        type: "system",
        data,
      }));

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error("❌ SystemNotification.broadcast error:", error);
      throw error;
    }
  }

  /**
   * Send to specific roles
   */
  static async sendToRoles(roles, title, message, data = {}) {
    try {
      const users = await User.find({
        role: { $in: roles },
        isActive: true,
      }).select("_id");

      const notifications = users.map((user) => ({
        userId: user._id,
        title,
        message,
        type: "system",
        data,
      }));

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error("❌ SystemNotification.sendToRoles error:", error);
      throw error;
    }
  }
}

module.exports = SystemNotification;
