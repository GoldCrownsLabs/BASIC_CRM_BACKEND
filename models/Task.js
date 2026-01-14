const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },
    priority: {
      type: String,
      enum: {
        values: ["low", "medium", "high", "urgent"],
        message: "Priority must be low, medium, high, or urgent",
      },
      default: "medium",
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "in_progress", "completed", "cancelled"],
        message: "Status must be pending, in_progress, completed, or cancelled",
      },
      default: "pending",
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    reminderDate: {
      type: Date,
    },
    isReminderSent: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    syncStatus: {
      type: String,
      enum: ["synced", "pending", "failed"],
      default: "synced",
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Remove the problematic pre-save middleware or fix it
taskSchema.pre("save", function (next) {
  try {
    this.lastModified = new Date();
    // Make sure to call next() correctly
    if (typeof next === "function") {
      next();
    }
  } catch (error) {
    // If next is not a function, just continue
    console.error("Pre-save middleware error:", error);
  }
});

module.exports = mongoose.model("Task", taskSchema);
