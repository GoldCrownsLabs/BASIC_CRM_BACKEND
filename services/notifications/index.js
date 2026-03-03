// services/notifications/index.js

const CoreNotification = require("./coreNotification");
const ContactNotification = require("./contactNotification");
const TaskNotification = require("./taskNotification");
const ProfileNotification = require("./profileNotification");
const PerformanceNotification = require("./performanceNotification");
const SystemNotification = require("./systemNotification");
const LeadNotification = require("./leadNotification");

module.exports = {
  // ==================== FEATURE MODULES ====================
  core: CoreNotification,
  contact: ContactNotification,
  task: TaskNotification,
  profile: ProfileNotification,
  performance: PerformanceNotification,
  system: SystemNotification,
  lead: LeadNotification,

  // ==================== LEGACY SUPPORT ====================
  // Core CRUD operations (for backward compatibility)
  createNotification: CoreNotification.create.bind(CoreNotification),
  createBulkNotifications: CoreNotification.createBulk.bind(CoreNotification),
  getUserNotifications:
    CoreNotification.getUserNotifications.bind(CoreNotification),
  markAsRead: CoreNotification.markAsRead.bind(CoreNotification),
  markAllAsRead: CoreNotification.markAllAsRead.bind(CoreNotification),
  deleteNotification: CoreNotification.delete.bind(CoreNotification),
  getNotificationStats: CoreNotification.getStats.bind(CoreNotification),

  // ==================== CONTACT METHODS ====================
  notifyContactCreated:
    ContactNotification.notifyContactCreated.bind(ContactNotification),
  notifyContactConnected:
    ContactNotification.notifyContactConnected.bind(ContactNotification),
  notifyContactCompleted:
    ContactNotification.notifyContactCompleted.bind(ContactNotification),
  notifyBigDeal: ContactNotification.notifyBigDeal.bind(ContactNotification),

  // ==================== LEAD METHODS ====================
  notifyLeadCreated: LeadNotification.notifyLeadCreated.bind(LeadNotification),
  notifyLeadStatusChanged:
    LeadNotification.notifyLeadStatusChanged.bind(LeadNotification),
  notifyLeadAssigned:
    LeadNotification.notifyLeadAssigned.bind(LeadNotification),
  notifyLeadConverted:
    LeadNotification.notifyLeadConverted.bind(LeadNotification),
  notifyLeadScoreChanged:
    LeadNotification.notifyLeadScoreChanged.bind(LeadNotification),

  // ==================== PROFILE METHODS ====================
  notifyProfileCreated:
    ProfileNotification.notifyProfileCreated.bind(ProfileNotification),
  notifyProfileUpdated:
    ProfileNotification.notifyProfileUpdated.bind(ProfileNotification),
  notifyRoleChanged:
    ProfileNotification.notifyRoleChanged.bind(ProfileNotification),

  // ==================== PERFORMANCE METHODS ====================
  notifyPerformanceMilestone: PerformanceNotification.notifyMilestone.bind(
    PerformanceNotification,
  ),
  sendWeeklyPerformanceSummary: PerformanceNotification.sendWeeklySummary.bind(
    PerformanceNotification,
  ),

  // ==================== SYSTEM METHODS ====================
  sendSystemNotification:
    SystemNotification.sendToUser.bind(SystemNotification),
  broadcastSystemNotification:
    SystemNotification.broadcast.bind(SystemNotification),
};
