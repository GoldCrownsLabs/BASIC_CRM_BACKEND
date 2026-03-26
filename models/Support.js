const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    // Ticket Information
    ticketId: {
      type: String,
      unique: true,
      sparse: true,
    },
    type: {
      type: String,
      enum: ["support", "feedback", "faq-feedback", "general"],
      default: "support",
    },

    // User Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Contact Form Fields
    subject: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Feedback Specific Fields
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedbackComment: {
      type: String,
      trim: true,
    },

    // FAQ Tracking
    faqCategory: {
      type: String,
      enum: [
        "Contacts",
        "Calendar",
        "General",
        "Data",
        "Tasks",
        "Security",
        "Activities",
        "Dashboard",
        "Other",
      ],
      default: "Other",
    },
    faqId: {
      type: Number,
    },
    helpful: {
      type: Boolean,
      default: null,
    },

    // Status and Tracking
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // Metadata
    deviceInfo: {
      platform: String,
      appVersion: String,
      osVersion: String,
      deviceModel: String,
    },
    attachments: [
      {
        filename: String,
        url: String,
        size: Number,
        type: String,
      },
    ],

    // Response Tracking
    responses: [
      {
        message: String,
        sentBy: {
          type: String,
          enum: ["user", "support"],
          default: "support",
        },
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        attachments: [String],
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timestamps
    resolvedAt: Date,
    closedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Generate unique ticket ID
supportSchema.pre("save", async function (next) {
  if (!this.ticketId && this.type === "support") {
    const prefix = "TKT";
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, month - 1, day),
        $lt: new Date(year, month - 1, day + 1),
      },
    });

    this.ticketId = `${prefix}-${year}${month}${day}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Virtual for response count
supportSchema.virtual("responseCount").get(function () {
  return this.responses ? this.responses.length : 0;
});

// Method to add response
supportSchema.methods.addResponse = function (
  message,
  sentBy,
  senderId,
  attachments = [],
) {
  this.responses.push({
    message,
    sentBy,
    senderId,
    attachments,
  });

  if (sentBy === "support") {
    this.status = "in-progress";
  } else if (sentBy === "user" && this.status === "closed") {
    this.status = "open";
  }

  return this.save();
};

// Method to resolve ticket
supportSchema.methods.resolve = function () {
  this.status = "resolved";
  this.resolvedAt = new Date();
  return this.save();
};

// Method to close ticket
supportSchema.methods.close = function () {
  this.status = "closed";
  this.closedAt = new Date();
  return this.save();
};

// Static method to get statistics
supportSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $facet: {
        totalTickets: [{ $match: { type: "support" } }, { $count: "count" }],
        openTickets: [
          { $match: { type: "support", status: "open" } },
          { $count: "count" },
        ],
        resolvedToday: [
          {
            $match: {
              type: "support",
              resolvedAt: {
                $gte: new Date().setHours(0, 0, 0, 0),
              },
            },
          },
          { $count: "count" },
        ],
        averageRating: [
          { $match: { type: "feedback", rating: { $exists: true } } },
          {
            $group: {
              _id: null,
              avg: { $avg: "$rating" },
              total: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  return stats[0];
};

const Support = mongoose.model("Support", supportSchema);

module.exports = Support;
