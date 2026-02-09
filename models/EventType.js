// models/EventType.js
const mongoose = require("mongoose");

const eventTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Event type name is required"],
      unique: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#3B82F6",
      required: true,
    },
    icon: {
      type: String,
      default: "calendar",
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Add default event types if collection is empty
eventTypeSchema.post("save", async function () {
  const count = await mongoose.model("EventType").countDocuments();
  if (count === 1) {
    // First event type created, add default ones
    const defaultTypes = [
      {
        name: "Meeting",
        color: "#3B82F6",
        icon: "users",
        description: "Business meetings",
        order: 1,
      },
      {
        name: "Appointment",
        color: "#10B981",
        icon: "calendar",
        description: "Scheduled appointments",
        order: 2,
      },
      {
        name: "Task",
        color: "#F59E0B",
        icon: "check-circle",
        description: "Tasks and to-dos",
        order: 3,
      },
      {
        name: "Reminder",
        color: "#EF4444",
        icon: "bell",
        description: "Important reminders",
        order: 4,
      },
      {
        name: "Personal",
        color: "#8B5CF6",
        icon: "user",
        description: "Personal events",
        order: 5,
      },
      {
        name: "Deadline",
        color: "#F97316",
        icon: "clock",
        description: "Project deadlines",
        order: 6,
      },
      {
        name: "Birthday",
        color: "#EC4899",
        icon: "gift",
        description: "Birthdays and anniversaries",
        order: 7,
      },
      {
        name: "Holiday",
        color: "#14B8A6",
        icon: "sun",
        description: "Public holidays",
        order: 8,
      },
    ];

    try {
      await mongoose.model("EventType").insertMany(defaultTypes);
      console.log("Default event types added successfully");
    } catch (error) {
      console.error("Error adding default event types:", error);
    }
  }
});

module.exports = mongoose.model("EventType", eventTypeSchema);
