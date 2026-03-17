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
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
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
// ✅ FIXED VIRTUALS - WITH NULL CHECKS
// ============================================

userSchema.virtual("hasActiveSubscription").get(function () {
  return !!this.currentSubscription;
});

// ✅ FIXED: Added null check for trialHistory
userSchema.virtual("isInTrial").get(function () {
  if (!this.trialHistory || !this.trialHistory.length) return false;
  
  const lastTrial = this.trialHistory[this.trialHistory.length - 1];
  if (!lastTrial) return false;
  
  const now = new Date();
  return (
    lastTrial.endedAt && lastTrial.endedAt > now && !lastTrial.convertedToPaid
  );
});

// ✅ FIXED: Added null check for trialHistory
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

// ✅ This was already safe
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

userSchema.methods.addToSubscriptionHistory = async function (
  subscription,
  plan,
) {
  this.subscriptionHistory.push({
    subscription: subscription._id,
    planName: plan.name,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    status: subscription.status,
    amount: subscription.amount,
    razorpaySubscriptionId: subscription.razorpaySubscriptionId,
  });
  this.currentSubscription = subscription._id;
  await this.save();
};

userSchema.methods.updateFeatureAccess = async function (plan) {
  if (plan && plan.featureAccess) {
    this.featureAccess = {
      ...this.featureAccess,
      ...plan.featureAccess,
    };
    await this.save();
  }
};

userSchema.methods.markTrialUsed = async function (
  planId,
  planName,
  startDate,
  endDate,
  authTxnId,
) {
  this.trialUsed = true;
  this.trialEligible = false;
  this.trialHistory.push({
    planId,
    planName,
    startedAt: startDate,
    endedAt: endDate,
    convertedToPaid: false,
    authTransactionId: authTxnId,
  });
  await this.save();
};

userSchema.methods.convertTrialToPaid = async function (subscriptionId) {
  const lastTrial = this.trialHistory[this.trialHistory.length - 1];
  if (lastTrial) {
    lastTrial.convertedToPaid = true;
  }
  await this.save();
};

userSchema.methods.addPaymentMethod = async function (methodData) {
  if (methodData.isDefault || this.paymentMethods.length === 0) {
    this.paymentMethods.forEach((m) => (m.isDefault = false));
    methodData.isDefault = true;
  }
  this.paymentMethods.push({
    ...methodData,
    addedAt: new Date(),
  });
  await this.save();
  return this.paymentMethods[this.paymentMethods.length - 1];
};

userSchema.methods.removePaymentMethod = async function (methodId) {
  this.paymentMethods = this.paymentMethods.filter(
    (m) => m._id.toString() !== methodId,
  );
  if (
    this.paymentMethods.length > 0 &&
    !this.paymentMethods.some((m) => m.isDefault)
  ) {
    this.paymentMethods[0].isDefault = true;
  }
  await this.save();
};

userSchema.methods.updateBillingDetails = async function (details) {
  this.billingDetails = {
    ...this.billingDetails,
    ...details,
  };
  await this.save();
};

userSchema.methods.startGracePeriod = async function () {
  const graceEnd = new Date();
  graceEnd.setDate(
    graceEnd.getDate() + this.subscriptionPreferences.gracePeriodDays,
  );
  this.gracePeriodEndsAt = graceEnd;
  await this.save();
};

userSchema.methods.endGracePeriod = async function () {
  this.gracePeriodEndsAt = null;
  await this.save();
};

userSchema.methods.updateInvoiceSummary = async function (amount) {
  this.invoiceSummary.totalPaid += amount;
  this.invoiceSummary.totalInvoices += 1;
  this.invoiceSummary.lastInvoiceDate = new Date();
  this.invoiceSummary.lastInvoiceAmount = amount;
  await this.save();
};

userSchema.methods.applyCoupon = async function (couponData) {
  this.activeCoupons.push({
    ...couponData,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  await this.save();
};

userSchema.methods.generateReferralCode = async function () {
  const code = `${this.name.slice(0, 3).toUpperCase()}${Date.now().toString(36)}`;
  this.referralCode = code;
  await this.save();
  return code;
};

userSchema.methods.addReferralEarnings = async function (amount) {
  this.referralEarnings += amount;
  await this.save();
};

userSchema.methods.getDefaultSenderEmail = function () {
  if (this.emailSettings && this.emailSettings.emailIdentities) {
    const defaultIdentity = this.emailSettings.emailIdentities.find(
      (i) => i.isDefault,
    );
    if (defaultIdentity) return defaultIdentity.email;
  }
  if (this.companyEmail) return this.companyEmail;
  return this.email;
};

userSchema.methods.getSmtpConfig = function () {
  const defaultConfig = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: this.email,
      pass: null,
    },
  };
  if (this.emailSettings && this.emailSettings.smtpHost) {
    return {
      host: this.emailSettings.smtpHost,
      port: this.emailSettings.smtpPort || 587,
      secure: this.emailSettings.smtpSecure || false,
      auth: {
        user: this.emailSettings.smtpUser || this.email,
        pass: this.emailSettings.smtpPassword,
      },
    };
  }
  return defaultConfig;
};

userSchema.methods.getTeamMembers = async function () {
  if (this.teamMembers && this.teamMembers.length > 0) {
    return await this.model("User")
      .find({
        _id: { $in: this.teamMembers },
        isActive: true,
      })
      .select("_id name email pushToken notificationSettings emailSettings");
  }
  return [];
};

userSchema.methods.getReportingChain = async function () {
  const chain = [];
  let currentUser = this;
  while (currentUser.reportingTo) {
    const manager = await this.model("User").findById(currentUser.reportingTo);
    if (manager && manager.isActive) {
      chain.push(manager);
      currentUser = manager;
    } else {
      break;
    }
  }
  return chain;
};

userSchema.methods.shouldReceiveNotification = function (type) {
  if (!this.notificationSettings) return true;
  switch (type) {
    case "task":
      return this.notificationSettings.taskNotifications;
    case "lead":
      return this.notificationSettings.leadNotifications;
    case "project":
      return this.notificationSettings.projectNotifications;
    case "push":
      return this.notificationSettings.pushNotifications;
    default:
      return true;
  }
};

userSchema.methods.canSendEmail = async function () {
  const limits = this.emailSettings?.preferences || {
    dailySendLimit: 500,
    hourlySendLimit: 50,
  };
  return {
    allowed: true,
    remainingDaily: limits.dailySendLimit,
    remainingHourly: limits.hourlySendLimit,
  };
};

// ============================================
// STATIC METHODS
// ============================================
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

userSchema.statics.getManagersAndAdmins = async function () {
  return await this.find({
    role: { $in: ["admin", "manager", "supervisor"] },
    isActive: true,
  }).select("_id name email pushToken notificationSettings emailSettings");
};

userSchema.statics.getUsersWithExpiringSubscriptions = async function (
  days = 7,
) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return await this.find({
    currentSubscription: { $ne: null },
    "subscriptionPreferences.notifyBeforeExpiry": { $gte: days },
  }).populate({
    path: "currentSubscription",
    populate: { path: "planId" },
  });
};

userSchema.statics.getUsersInTrial = async function () {
  const now = new Date();
  return await this.find({
    trialUsed: true,
    "trialHistory.endedAt": { $gt: now },
    "trialHistory.convertedToPaid": false,
  });
};

userSchema.statics.getUsersInGracePeriod = async function () {
  const now = new Date();
  return await this.find({
    gracePeriodEndsAt: { $gt: now },
  });
};

userSchema.statics.findByPlan = async function (planName) {
  return await this.find({
    "subscriptionHistory.planName": planName,
    "subscriptionHistory.status": "active",
  }).populate("currentSubscription");
};

userSchema.statics.getSubscriptionStats = async function () {
  const now = new Date();
  const stats = await this.aggregate([
    {
      $facet: {
        total: [{ $count: "total" }],
        withSubscription: [
          { $match: { currentSubscription: { $ne: null } } },
          { $count: "count" },
        ],
        inTrial: [
          {
            $match: {
              trialUsed: true,
              "trialHistory.endedAt": { $gt: now },
              "trialHistory.convertedToPaid": false,
            },
          },
          { $count: "count" },
        ],
        inGracePeriod: [
          { $match: { gracePeriodEndsAt: { $gt: now } } },
          { $count: "count" },
        ],
        byRole: [{ $group: { _id: "$role", count: { $sum: 1 } } }],
      },
    },
  ]);
  return stats[0];
};

module.exports = mongoose.model("User", userSchema);