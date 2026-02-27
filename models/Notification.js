const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "calendar",
        "calendar_reminder",
        "calendar_invite",
        "calendar_update",
        "contact",
        "task",
        "lead",
        "project",
        "system",
        "reminder",
        "success",
        "error",
        "info",
        "order",
        "payment",
      ],
      default: "info",
    },
    // Calendar specific fields
    calendarData: {
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CalendarEvent",
      },
      eventType: {
        type: String,
        enum: [
          "meeting",
          "call",
          "email",
          "task",
          "deadline",
          "reminder",
          "appointment",
          "other",
        ],
      },
      eventDate: Date,
      eventTime: String,
      action: {
        type: String,
        enum: [
          "created",
          "updated",
          "deleted",
          "status_changed",
          "reminder",
          "assigned",
          "invited",
        ],
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true, // ADD THIS for sorting by priority
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date, // ADD THIS - track when notification was read
    pushSent: {
      type: Boolean,
      default: false,
    },
    pushToken: String,
    // For grouping notifications
    category: {
      type: String,
      enum: ["calendar", "tasks", "leads", "system", "communication"],
      default: "system",
    },
    // For rich notifications
    icon: String,
    color: String,
    badgeCount: {
      type: Number,
      default: 1,
    },
    // For action buttons in notifications
    actions: [
      {
        label: String,
        action: String,
        link: String,
        color: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    // TTL index for auto deletion
    expireAfterSeconds: 2592000, // 30 days in seconds
  },
);

// Indexes for better performance
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, read: 1 });
notificationSchema.index({ userId: 1, category: 1, read: 1 });
notificationSchema.index({ "calendarData.eventId": 1 });
notificationSchema.index({ "calendarData.performedBy": 1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, read: 1 });

// Virtual for time ago
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  return "Just now";
});

// Virtual for formatted date
notificationSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
});

// Virtual for formatted time
notificationSchema.virtual("formattedTime").get(function () {
  return this.createdAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
});

// Pre-save middleware to set category based on type

notificationSchema.pre("save", function (next) {
  if (!this.category) {
    const typeToCategory = {
      calendar: "calendar",
      calendar_reminder: "calendar",
      calendar_invite: "calendar",
      calendar_update: "calendar",
      contact: "communication", // <-- ADD THIS
      task: "tasks",
      reminder: "tasks",
      lead: "leads",
      project: "tasks",
      order: "leads",
      payment: "leads",
      system: "system",
      success: "system",
      error: "system",
      info: "system",
    };

    this.category = typeToCategory[this.type] || "system";
  }

  // Set icon and color based on type
  if (!this.icon || !this.color) {
    const typeConfig = {
      calendar: { icon: "calendar", color: "#3B82F6" },
      calendar_reminder: { icon: "bell", color: "#EF4444" },
      calendar_invite: { icon: "user-plus", color: "#8B5CF6" },
      calendar_update: { icon: "edit", color: "#F59E0B" },
      contact: { icon: "user", color: "#10B981" }, // <-- ADD THIS
      task: { icon: "check-circle", color: "#10B981" },
      reminder: { icon: "clock", color: "#F59E0B" },
      lead: { icon: "user", color: "#8B5CF6" },
      project: { icon: "folder", color: "#EC4899" },
      system: { icon: "info", color: "#6B7280" },
      success: { icon: "check", color: "#10B981" },
      error: { icon: "x-circle", color: "#EF4444" },
      info: { icon: "info", color: "#3B82F6" },
    };

    const config = typeConfig[this.type] || { icon: "bell", color: "#6B7280" };
    this.icon = config.icon;
    this.color = config.color;
  }

  next();
});

// Static method to create calendar notification
notificationSchema.statics.createCalendarNotification = async function ({
  userId,
  title,
  message,
  eventId,
  eventType,
  eventDate,
  eventTime,
  action,
  performedBy,
  priority = "medium",
}) {
  return this.create({
    userId,
    title,
    message,
    type: "calendar",
    calendarData: {
      eventId,
      eventType,
      eventDate,
      eventTime,
      action,
      performedBy,
    },
    priority,
    category: "calendar",
    actions: [
      {
        label: "View Event",
        action: "view_event",
        link: `/calendar/event/${eventId}`,
      },
      {
        label: "Mark as Read",
        action: "mark_read",
        color: "#10B981",
      },
    ],
  });
};

// Static method to create calendar reminder
notificationSchema.statics.createCalendarReminder = async function ({
  userId,
  eventId,
  title,
  message,
  eventDate,
  eventTime,
}) {
  return this.create({
    userId,
    title: title || "Event Reminder",
    message: message || "You have an upcoming event",
    type: "calendar_reminder",
    calendarData: {
      eventId,
      eventDate,
      eventTime,
      action: "reminder",
    },
    priority: "high",
    category: "calendar",
    icon: "bell",
    color: "#EF4444",
    actions: [
      {
        label: "View Event",
        action: "view_event",
        link: `/calendar/event/${eventId}`,
      },
      {
        label: "Snooze",
        action: "snooze_reminder",
        color: "#F59E0B",
      },
    ],
  });
};

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Method to get notification summary
notificationSchema.methods.getSummary = function () {
  return {
    id: this._id,
    title: this.title,
    message: this.message,
    type: this.type,
    category: this.category,
    priority: this.priority,
    icon: this.icon,
    color: this.color,
    timeAgo: this.timeAgo,
    formattedDate: this.formattedDate,
    formattedTime: this.formattedTime,
    read: this.read,
    calendarData: this.calendarData,
    actions: this.actions,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Notification", notificationSchema);
