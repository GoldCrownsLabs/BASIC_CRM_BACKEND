const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  firstName: {
    type: String,
    required: [true, "Please add first name"],
    trim: true,
    minlength: [2, "First name must be at least 2 characters"],
  },
  lastName: {
    type: String,
    trim: true,
  },
  company: {
    type: String,
    trim: true,
  },
  jobTitle: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        if (!v) return true; // Optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(v);
      },
      message: "Please enter a valid email address",
    },
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        if (!v) return true; // Optional
        const phoneRegex = /^[\d\s\-\+\(\)]{10,20}$/;
        return phoneRegex.test(v);
      },
      message: "Please enter a valid phone number (10-20 digits)",
    },
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true },
  },
  source: {
    type: String,
    enum: ["website", "referral", "social", "event", "other"],
    default: "other",
  },
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, "Notes cannot exceed 2000 characters"],
  },
  lastContacted: {
    type: Date,
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
  syncStatus: {
    type: String,
    enum: ["synced", "pending", "error"],
    default: "synced",
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
contactSchema.index({ userId: 1, lastName: 1 });
contactSchema.index({ userId: 1, company: 1 });
contactSchema.index({ userId: 1, createdAt: -1 });
contactSchema.index({ userId: 1, isFavorite: 1 });
contactSchema.index({ userId: 1, tags: 1 });
contactSchema.index({ userId: 1, email: 1 });

// ✅ FIXED: Update timestamps on save (WITH SAFE CHECK)
contactSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  if (this.isNew) {
    this.createdAt = Date.now();
  }

  // ✅ IMPORTANT FIX: Check if next is a function before calling
  if (typeof next === "function") {
    return next();
  }

  // If next is not a function, just continue (no error)
  // This handles cases where hook is called from different contexts
  console.warn(
    "⚠️ Contact pre-save: next parameter not available, continuing..."
  );
});

module.exports = mongoose.model("Contact", contactSchema);
