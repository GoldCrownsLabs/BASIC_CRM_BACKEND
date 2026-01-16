const mongoose = require("mongoose");
const dashboardController = require("../controllers/authDashboard");

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: String,
    company: String,
    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Won",
        "Lost",
      ],
      default: "New",
    },
    source: {
      type: String,
      enum: ["Website", "Referral", "Social Media", "Email", "Other"],
      default: "Website",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    value: {
      type: Number,
      default: 0,
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastContacted: Date,
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Deferred"],
      default: "Pending",
    },
    dueDate: Date,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    relatedTo: {
      type: String,
      enum: ["Lead", "Contact", "Deal", "None"],
      default: "None",
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedTo",
    },
    completedAt: Date,
  },
  { timestamps: true }
);

const contactSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: String,
    company: String,
    jobTitle: String,
    department: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    type: {
      type: String,
      enum: ["Customer", "Prospect", "Partner", "Vendor", "Other"],
      default: "Customer",
    },
    leadSource: String,
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [String],
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Call", "Email", "Meeting", "Note", "Task", "Other"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    relatedTo: {
      type: String,
      enum: ["Lead", "Contact", "Deal", "Task", "None"],
      default: "None",
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedTo",
    },
    startTime: Date,
    endTime: Date,
    location: String,
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled", "Postponed"],
      default: "Scheduled",
    },
    outcome: String,
  },
  { timestamps: true }
);

// Dashboard stats schema (for aggregated data)
const dashboardStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  totalLeads: {
    type: Number,
    default: 0,
  },
  activeLeads: {
    type: Number,
    default: 0,
  },
  wonLeads: {
    type: Number,
    default: 0,
  },
  totalContacts: {
    type: Number,
    default: 0,
  },
  pendingTasks: {
    type: Number,
    default: 0,
  },
  overdueTasks: {
    type: Number,
    default: 0,
  },
  recentActivities: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
    },
  ],
  leadByStatus: {
    New: Number,
    Contacted: Number,
    Qualified: Number,
    Proposal: Number,
    Negotiation: Number,
    Won: Number,
    Lost: Number,
  },
  leadBySource: {
    Website: Number,
    Referral: Number,
    "Social Media": Number,
    Email: Number,
    Other: Number,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Create models
const Lead = mongoose.model("Lead", leadSchema);
const Task = mongoose.model("Task", taskSchema);
const Contact = mongoose.model("Contact", contactSchema);
const Activity = mongoose.model("Activity", activitySchema);
const DashboardStats = mongoose.model("DashboardStats", dashboardStatsSchema);

module.exports = {
  Lead,
  Task,
  Contact,
  Activity,
  DashboardStats,
};
