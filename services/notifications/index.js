// services/notifications/index.js


const CoreNotification = require("./coreNotification");
const ContactNotification = require("./contactNotification");
const TaskNotification = require("./taskNotification");
const ProfileNotification = require("./profileNotification");
const PerformanceNotification = require("./performanceNotification");
const SystemNotification = require("./systemNotification");

module.exports = {
  // Core CRUD operations
  core: CoreNotification,

  // Feature-specific notifications
  contact: ContactNotification,
  task: TaskNotification,
  profile: ProfileNotification,
  performance: PerformanceNotification,
  system: SystemNotification,

  // ✅ Legacy support (agar purane code mein use ho raha hai)
  createNotification: CoreNotification.create.bind(CoreNotification),
  createBulkNotifications: CoreNotification.createBulk.bind(CoreNotification),
  getUserNotifications:
    CoreNotification.getUserNotifications.bind(CoreNotification),
  markAsRead: CoreNotification.markAsRead.bind(CoreNotification),
  markAllAsRead: CoreNotification.markAllAsRead.bind(CoreNotification),
  deleteNotification: CoreNotification.delete.bind(CoreNotification),
  getNotificationStats: CoreNotification.getStats.bind(CoreNotification),

  // Contact methods (legacy)
  notifyContactCreated:
    ContactNotification.notifyContactCreated.bind(ContactNotification),
  notifyContactConnected:
    ContactNotification.notifyContactConnected.bind(ContactNotification),
  notifyContactCompleted:
    ContactNotification.notifyContactCompleted.bind(ContactNotification),
  notifyLeadStatusChanged:
    ContactNotification.notifyLeadStatusChanged.bind(ContactNotification),
  notifyBigDeal: ContactNotification.notifyBigDeal.bind(ContactNotification),

  // Performance methods (legacy)
  notifyPerformanceMilestone: PerformanceNotification.notifyMilestone.bind(
    PerformanceNotification,
  ),
  sendWeeklyPerformanceSummary: PerformanceNotification.sendWeeklySummary.bind(
    PerformanceNotification,
  ),

  // System methods (legacy)
  sendSystemNotification:
    SystemNotification.sendToUser.bind(SystemNotification),
  broadcastSystemNotification:
    SystemNotification.broadcast.bind(SystemNotification),
};
