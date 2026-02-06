const mongoose = require("mongoose");

const calendarEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    type: {
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
      default: "meeting",
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String,
      default: "",
    },
    duration: {
      type: Number, // in minutes
      default: 60,
    },
    contactName: {
      type: String,
      default: "",
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
    },
    company: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "postponed", "in-progress"],
      default: "scheduled",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    color: {
      type: String,
      default: "#3B82F6",
    },
    isAllDay: {
      type: Boolean,
      default: false,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPattern: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      default: "weekly",
    },
    recurringEndDate: Date,
    reminders: [
      {
        type: Number, // minutes before
        default: [15, 30, 60],
      },
    ],
    attachments: [
      {
        filename: String,
        url: String,
        uploadedAt: Date,
      },
    ],
    notes: [
      {
        content: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    tags: [String],
    metadata: {
      lastUpdated: Date,
      createdVia: {
        type: String,
        enum: ["web", "mobile", "api", "import"],
        default: "web",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for performance
calendarEventSchema.index({ date: 1, assignedTo: 1 });
calendarEventSchema.index({ assignedTo: 1, status: 1 });
calendarEventSchema.index({ contactId: 1 });
calendarEventSchema.index({ type: 1 });
calendarEventSchema.index({ isRecurring: 1 });

// Virtual for formatted date
calendarEventSchema.virtual("formattedDate").get(function () {
  return this.date.toISOString().split("T")[0];
});

// Pre-save middleware
calendarEventSchema.pre("save", function (next) {
  if (!this.endTime && this.startTime && this.duration) {
    const [hours, minutes] = this.startTime.split(":").map(Number);
    const endMinutes = hours * 60 + minutes + this.duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    this.endTime = `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
  }
  this.metadata.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);
