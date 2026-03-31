const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema(
  {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: "India" },
    zipCode: String,
    isDefault: { type: Boolean, default: false },
    addressType: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },
  },
  { _id: true },
);

// Email Settings Schema (Nested for better organization)
const emailSettingsSchema = new mongoose.Schema(
  {
    smtpHost: {
      type: String,
      default: "smtp.gmail.com",
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    smtpSecure: {
      type: Boolean,
      default: false,
    },
    smtpUser: {
      type: String,
      default: null,
    },
    smtpPassword: {
      type: String,
      default: null,
    },
    fromEmail: {
      type: String,
      default: null,
    },
    fromName: {
      type: String,
      default: null,
    },
    emailIdentities: [
      {
        email: String,
        name: String,
        isDefault: { type: Boolean, default: false },
        smtpHost: String,
        smtpPort: Number,
        smtpUser: String,
        smtpPassword: String,
        signature: String,
        isVerified: { type: Boolean, default: false },
      },
    ],
    preferences: {
      defaultSender: { type: String, default: "personal" },
      trackOpens: { type: Boolean, default: true },
      trackClicks: { type: Boolean, default: true },
      saveToSent: { type: Boolean, default: true },
      dailySendLimit: { type: Number, default: 500 },
      hourlySendLimit: { type: Number, default: 50 },
    },
    signature: {
      type: String,
      default: "",
    },
    defaultTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // ✅ Password is optional for Google users
    password: {
      type: String,
      required: false,
      minlength: 6,
    },
    // ✅ Google authentication fields
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },
    companyEmail: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      validate: {
        validator: function (v) {
          return !v || /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Please enter a valid company email",
      },
    },
    emailSettings: {
      type: emailSettingsSchema,
      default: () => ({}),
    },
    addresses: [addressSchema],
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: "India" },
      zipCode: String,
      isDefault: { type: Boolean, default: false },
    },
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
      },
    ],
    pushToken: {
      type: String,
      default: null,
    },
    notificationSettings: {
      taskNotifications: { type: Boolean, default: true },
      leadNotifications: { type: Boolean, default: true },
      projectNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      inAppNotifications: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      vibrationEnabled: { type: Boolean, default: true },
    },
    lastNotificationCheck: {
      type: Date,
      default: Date.now,
    },
    notificationBadgeCount: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      enum: ["user", "admin", "manager", "supervisor"],
      default: "user",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    newsletterSubscription: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
    department: {
      type: String,
      enum: [
        "sales",
        "marketing",
        "support",
        "development",
        "management",
        "other",
      ],
      default: "other",
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // SUBSCRIPTION FIELDS
    currentSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },

    subscriptionHistory: [
      {
        subscription: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subscription",
        },
        planName: {
          type: String,
          enum: ["monthly", "quarterly", "half_yearly", "yearly"],
        },
        startDate: Date,
        endDate: Date,
        status: {
          type: String,
          enum: ["active", "expired", "cancelled", "trial"],
        },
        amount: Number,
        razorpaySubscriptionId: String,
      },
    ],

    razorpayCustomerId: {
      type: String,
      sparse: true,
      index: true,
    },

    trialEligible: {
      type: Boolean,
      default: true,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    trialHistory: [
      {
        planId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Plan",
        },
        planName: String,
        startedAt: Date,
        endedAt: Date,
        convertedToPaid: {
          type: Boolean,
          default: false,
        },
        authTransactionId: String,
      },
    ],

    paymentMethods: [
      {
        type: {
          type: String,
          enum: ["card", "upi", "netbanking", "wallet"],
        },
        razorpayMethodId: String,
        last4: String,
        network: String,
        bankName: String,
        isDefault: {
          type: Boolean,
          default: false,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: Date,
      },
    ],

    billingDetails: {
      gstin: {
        type: String,
        uppercase: true,
        match: [/^[0-9A-Z]{15}$/, "Invalid GSTIN format"],
      },
      companyName: String,
      billingEmail: {
        type: String,
        lowercase: true,
        trim: true,
      },
      billingPhone: String,
      billingAddress: {
        street: String,
        city: String,
        state: String,
        country: { type: String, default: "India" },
        zipCode: String,
      },
      panNumber: {
        type: String,
        uppercase: true,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"],
      },
    },

    subscriptionPreferences: {
      autoRenew: {
        type: Boolean,
        default: true,
      },
      emailInvoices: {
        type: Boolean,
        default: true,
      },
      smsAlerts: {
        type: Boolean,
        default: false,
      },
      paymentReminders: {
        type: Boolean,
        default: true,
      },
      preferredCurrency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD"],
      },
      gracePeriodDays: {
        type: Number,
        default: 5,
      },
      notifyBeforeExpiry: {
        type: Number,
        default: 7,
      },
    },

    gracePeriodEndsAt: Date,

    featureAccess: {
      maxUsers: { type: Number, default: 1 },
      maxLeads: { type: Number, default: 100 },
      maxContacts: { type: Number, default: 100 },
      maxTasks: { type: Number, default: 50 },
      maxProjects: { type: Number, default: 5 },
      maxStorage: { type: Number, default: 1024 },
      advancedReports: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      emailCampaigns: { type: Boolean, default: false },
      customFields: { type: Boolean, default: true },
      bulkOperations: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      dataExport: { type: Boolean, default: true },
      teamCollaboration: { type: Boolean, default: false },
      whiteLabel: { type: Boolean, default: false },
    },

    usageMetrics: {
      currentLeads: { type: Number, default: 0 },
      currentContacts: { type: Number, default: 0 },
      currentTasks: { type: Number, default: 0 },
      currentProjects: { type: Number, default: 0 },
      storageUsed: { type: Number, default: 0 },
      apiCallsThisMonth: { type: Number, default: 0 },
      emailsSentThisMonth: { type: Number, default: 0 },
    },

    invoiceSummary: {
      totalPaid: { type: Number, default: 0 },
      totalInvoices: { type: Number, default: 0 },
      lastInvoiceDate: Date,
      lastInvoiceAmount: Number,
    },

    activeCoupons: [
      {
        code: String,
        discountType: {
          type: String,
          enum: ["percentage", "fixed"],
        },
        discountValue: Number,
        validUntil: Date,
        appliedToPlan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Plan",
        },
      },
    ],

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    referralEarnings: {
      type: Number,
      default: 0,
    },

    limitsWarning: {
      leadsWarning: { type: Boolean, default: false },
      contactsWarning: { type: Boolean, default: false },
      tasksWarning: { type: Boolean, default: false },
      storageWarning: { type: Boolean, default: false },
      warningSentAt: Date,
    },

    cancellationFeedback: {
      reason: String,
      feedback: String,
      cancelledAt: Date,
      alternativePlan: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================
// INDEXES
// ============================================
userSchema.index({ "subscriptionHistory.subscription": 1 });
userSchema.index({ trialUsed: 1 });
userSchema.index({ "billingDetails.gstin": 1 });
userSchema.index({ "subscriptionPreferences.autoRenew": 1 });

// ============================================
// VIRTUALS
// ============================================

userSchema.virtual("hasActiveSubscription").get(function () {
  return !!this.currentSubscription;
});

userSchema.virtual("isInTrial").get(function () {
  if (!this.trialHistory || !this.trialHistory.length) return false;
  const lastTrial = this.trialHistory[this.trialHistory.length - 1];
  if (!lastTrial) return false;
  const now = new Date();
  return (
    lastTrial.endedAt && lastTrial.endedAt > now && !lastTrial.convertedToPaid
  );
});

userSchema.virtual("remainingTrialDays").get(function () {
  if (!this.trialHistory || !this.trialHistory.length) return 0;
  const lastTrial = this.trialHistory[this.trialHistory.length - 1];
  if (!lastTrial || !lastTrial.endedAt) return 0;
  const now = new Date();
  const remaining = Math.ceil(
    (lastTrial.endedAt - now) / (1000 * 60 * 60 * 24),
  );
  return remaining > 0 ? remaining : 0;
});

userSchema.virtual("isInGracePeriod").get(function () {
  if (!this.gracePeriodEndsAt) return false;
  return new Date() < this.gracePeriodEndsAt;
});

userSchema.virtual("defaultPaymentMethod").get(function () {
  if (!this.paymentMethods || this.paymentMethods.length === 0) {
    return null;
  }
  return this.paymentMethods.find((m) => m.isDefault) || this.paymentMethods[0];
});

// ============================================
// METHODS
// ============================================
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.canAccess = function (feature) {
  if (["admin", "supervisor"].includes(this.role)) {
    return true;
  }
  if (!this.hasActiveSubscription) {
    const basicFeatures = [
      "maxLeads",
      "maxContacts",
      "maxTasks",
      "maxProjects",
    ];
    if (basicFeatures.includes(feature)) {
      return this.featureAccess[feature] > 0;
    }
    return false;
  }
  if (typeof this.featureAccess[feature] === "boolean") {
    return this.featureAccess[feature];
  }
  if (typeof this.featureAccess[feature] === "number") {
    return this.featureAccess[feature] > 0;
  }
  return false;
};

userSchema.methods.hasReachedLimit = function (resourceType) {
  const limits = {
    leads: this.featureAccess.maxLeads,
    contacts: this.featureAccess.maxContacts,
    tasks: this.featureAccess.maxTasks,
    projects: this.featureAccess.maxProjects,
    storage: this.featureAccess.maxStorage,
  };
  const usage = {
    leads: this.usageMetrics.currentLeads,
    contacts: this.usageMetrics.currentContacts,
    tasks: this.usageMetrics.currentTasks,
    projects: this.usageMetrics.currentProjects,
    storage: this.usageMetrics.storageUsed,
  };
  if (!limits[resourceType]) return false;
  const reached = usage[resourceType] >= limits[resourceType];
  if (!reached && usage[resourceType] >= limits[resourceType] * 0.8) {
    this.setLimitWarning(resourceType);
  }
  return reached;
};

userSchema.methods.setLimitWarning = function (resourceType) {
  const warningField = `${resourceType}Warning`;
  if (!this.limitsWarning[warningField]) {
    this.limitsWarning[warningField] = true;
    this.limitsWarning.warningSentAt = new Date();
  }
};

userSchema.methods.updateUsage = async function (resourceType, increment = 1) {
  const field = `usageMetrics.current${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`;
  if (this.usageMetrics[field] !== undefined) {
    this.usageMetrics[field] += increment;
    await this.save();
  }
};

// ============================================
// STATIC METHODS
// ============================================
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = mongoose.model("User", userSchema);
