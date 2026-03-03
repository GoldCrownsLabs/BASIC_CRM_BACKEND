const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    // Basic Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },

    // Professional Information
    company: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    jobTitle: {
      type: String,
      trim: true,
      default: "",
    },

    // Lead Status Fields
    leadStatus: {
      type: String,
      enum: ["cold", "warm", "hot", "connected", "completed"],
      default: "cold",
      index: true,
    },

    // Connected Status
    connected: {
      type: Boolean,
      default: false,
      index: true,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    connectedNotes: {
      type: String,
      trim: true,
      default: "",
    },

    // Completed Status
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedNotes: {
      type: String,
      trim: true,
      default: "",
    },

    // Revenue/Deal Information
    dealValue: {
      type: Number,
      min: [0, "Deal value cannot be negative"],
      default: 0,
    },
    dealCurrency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR", "GBP"],
    },
    dealClosedDate: {
      type: Date,
      default: null,
    },

    // Pipeline History
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["cold", "warm", "hot", "connected", "completed"],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],

    // Tags & Categories
    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    // Additional Info
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      street: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      zipCode: { type: String, trim: true, default: "" },
    },

    // Source & Tracking
    source: {
      type: String,
      enum: [
        "website",
        "referral",
        "social",
        "call",
        "email",
        "meeting",
        "other",
      ],
      default: "other",
    },
    lastContacted: {
      type: Date,
      default: null,
    },

    // Favorite
    isFavorite: {
      type: Boolean,
      default: false,
    },

    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better performance
contactSchema.index({ userId: 1, leadStatus: 1 });
contactSchema.index({ userId: 1, connected: 1 });
contactSchema.index({ userId: 1, completed: 1 });
contactSchema.index({ userId: 1, createdAt: -1 });
contactSchema.index({ userId: 1, dealValue: 1 });

// Virtual for full name
contactSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for completion percentage
contactSchema.virtual("completionPercentage").get(function () {
  const fields = [
    this.firstName,
    this.lastName,
    this.email,
    this.phone,
    this.company,
    this.jobTitle,
    this.source,
  ];

  const total = fields.length;
  const filled = fields.filter((f) => f && f.toString().trim() !== "").length;

  return Math.round((filled / total) * 100);
});

// Method to mark as connected
contactSchema.methods.markAsConnected = async function (userId, notes = "") {
  this.connected = true;
  this.leadStatus = "connected";
  this.connectedAt = new Date();
  this.connectedNotes = notes;

  this.statusHistory.push({
    status: "connected",
    changedAt: new Date(),
    changedBy: userId,
    notes: notes,
  });

  return this.save();
};

// Method to mark as completed
contactSchema.methods.markAsCompleted = async function (
  userId,
  dealValue,
  notes = "",
) {
  if (!dealValue || dealValue <= 0) {
    throw new Error("Deal value is required for completed deals");
  }

  this.completed = true;
  this.leadStatus = "completed";
  this.completedAt = new Date();
  this.completedNotes = notes;
  this.dealValue = dealValue;
  this.dealClosedDate = new Date();

  this.statusHistory.push({
    status: "completed",
    changedAt: new Date(),
    changedBy: userId,
    notes: `${notes} | Deal Value: ${dealValue}`,
  });

  return this.save();
};

// ===========================================
// FIXED PRE-SAVE MIDDLEWARE - NO MORE ERRORS!
// ===========================================
contactSchema.pre("save", async function () {
  console.log("🔵 PRE-SAVE HOOK STARTED");

  // 1. Auto-update leadStatus
  if (this.completed) {
    this.leadStatus = "completed";
  } else if (this.connected) {
    this.leadStatus = "connected";
  }

  // 2. Validate completed deals
  if (this.completed) {
    if (!this.dealValue || this.dealValue <= 0) {
      console.log("🔴 ERROR: Deal value missing for completed contact");
      throw new Error("Deal value is required for completed deals");
    }
  }
  // 3. Clean non-completed deals
  else {
    if (this.dealValue > 0) {
      console.log("🟡 Clearing deal value for non-completed contact");
      this.dealValue = 0;
      this.dealClosedDate = null;
    }
  }

  console.log("🟢 PRE-SAVE HOOK SUCCESS");
});
// ===========================================
// END FIXED MIDDLEWARE
// ===========================================

module.exports = mongoose.model("Contact", contactSchema);
