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

// ✅ Email Settings Schema (Nested for better organization)
const emailSettingsSchema = new mongoose.Schema(
  {
    // Default SMTP for this user
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
      default: false, // false for 587, true for 465
    },
    smtpUser: {
      type: String,
      default: null, // User ka email
    },
    smtpPassword: {
      type: String,
      default: null, // App password (encrypted store karo)
    },
    fromEmail: {
      type: String,
      default: null, // "noreply@company.com" ya user ka email
    },
    fromName: {
      type: String,
      default: null, // "CRM Team" ya user ka naam
    },
    // ✅ Multiple email identities
    emailIdentities: [
      {
        email: String,
        name: String,
        isDefault: { type: Boolean, default: false },
        smtpHost: String,
        smtpPort: Number,
        smtpUser: String,
        smtpPassword: String, // Encrypted
        signature: String, // Email signature
        isVerified: { type: Boolean, default: false },
      },
    ],
    // ✅ Email preferences
    preferences: {
      defaultSender: { type: String, default: "personal" }, // 'personal', 'company', 'specific'
      trackOpens: { type: Boolean, default: true },
      trackClicks: { type: Boolean, default: true },
      saveToSent: { type: Boolean, default: true },
      dailySendLimit: { type: Number, default: 500 },
      hourlySendLimit: { type: Number, default: 50 },
    },
    // ✅ Email signature
    signature: {
      type: String,
      default: "",
    },
    // ✅ Template preferences
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

    // ✅ COMPANY EMAIL (for official communication)
    companyEmail: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true, // Allows null/undefined
      validate: {
        validator: function (v) {
          return !v || /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Please enter a valid company email",
      },
    },

    // ✅ EMAIL SETTINGS (New field)
    emailSettings: {
      type: emailSettingsSchema,
      default: () => ({}),
    },

    // ✅ Address as Array (Multiple addresses support)
    addresses: [addressSchema],

    // Keep old shippingAddress for backward compatibility
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: "India" },
      zipCode: String,
      isDefault: { type: Boolean, default: false },
    },

    // E-commerce Specific
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

    // ✅ NOTIFICATION FIELDS
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

    // User Settings
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

    // Timestamps
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },

    // ✅ Additional fields for notifications
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
  },
  { timestamps: true },
);

// 🔑 Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 🔐 Manual password hashing in controller
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// ✅ Get managers/admins for notifications
userSchema.statics.getManagersAndAdmins = async function () {
  return await this.find({
    role: { $in: ["admin", "manager", "supervisor"] },
    isActive: true,
  }).select("_id name email pushToken notificationSettings emailSettings");
};

// ✅ Get team members for user
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

// ✅ Get reporting chain
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

// ✅ Check if user should receive notification
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

// ✅ NEW: Get user's default sender email
userSchema.methods.getDefaultSenderEmail = function () {
  // Priority:
  // 1. EmailSettings mein default identity
  // 2. Company email
  // 3. Personal email

  if (this.emailSettings && this.emailSettings.emailIdentities) {
    const defaultIdentity = this.emailSettings.emailIdentities.find(
      (i) => i.isDefault,
    );
    if (defaultIdentity) return defaultIdentity.email;
  }

  if (this.companyEmail) return this.companyEmail;

  return this.email; // Personal email
};

// ✅ NEW: Get user's SMTP config
userSchema.methods.getSmtpConfig = function () {
  // Default SMTP config (Gmail)
  const defaultConfig = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: this.email,
      pass: null, // User will provide this separately
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

// ✅ NEW: Check if user can send emails (rate limiting)
userSchema.methods.canSendEmail = async function () {
  // Implementation for rate limiting
  // Can check daily/hourly limits from emailSettings.preferences
  const limits = this.emailSettings?.preferences || {
    dailySendLimit: 500,
    hourlySendLimit: 50,
  };

  // You can implement actual tracking logic here
  return {
    allowed: true,
    remainingDaily: limits.dailySendLimit,
    remainingHourly: limits.hourlySendLimit,
  };
};

module.exports = mongoose.model("User", userSchema);
