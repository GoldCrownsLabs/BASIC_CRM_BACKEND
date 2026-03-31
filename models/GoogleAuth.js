const mongoose = require("mongoose");

const googleAuthSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    name: String,
    avatar: String,
    accessToken: String,
    refreshToken: String,
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    loginCount: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      locale: String,
      hd: String,
      emailVerified: Boolean,
      givenName: String,
      familyName: String,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// STATIC METHODS
// ============================================

// Find by Google ID
googleAuthSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId }).populate("userId");
};

// Find by Email
googleAuthSchema.statics.findByEmail = function (email) {
  return this.findOne({ email }).populate("userId");
};

// Update login info
googleAuthSchema.statics.updateLoginInfo = async function (googleId, tokens) {
  const updateData = {
    lastLoginAt: new Date(),
    $inc: { loginCount: 1 },
  };

  if (tokens?.accessToken) {
    updateData.accessToken = tokens.accessToken;
  }
  if (tokens?.refreshToken) {
    updateData.refreshToken = tokens.refreshToken;
  }

  return this.findOneAndUpdate({ googleId }, updateData, { new: true });
};

// ============================================
// INSTANCE METHODS
// ============================================

googleAuthSchema.methods.incrementLoginCount = function () {
  this.loginCount += 1;
  this.lastLoginAt = new Date();
  return this.save();
};

module.exports = mongoose.model("GoogleAuth", googleAuthSchema);
