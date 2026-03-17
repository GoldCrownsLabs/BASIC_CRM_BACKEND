// models/Coupon.js
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true, // ✅ unique automatically index bana deta hai
      uppercase: true,
      trim: true,
      // ❌ index: true HATANA HAI - unique already index banayega
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minPurchase: {
      type: Number,
      default: 0,
    },
    maxDiscount: {
      type: Number,
      default: null,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    applicablePlans: [
      {
        type: String,
        enum: ["monthly", "quarterly", "half_yearly", "yearly"],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    description: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// ✅ SIRF composite indexes yahan define karo (agar zaroorat ho)
couponSchema.index({ validFrom: 1, validUntil: 1 }); // For date range queries
// ❌ code ka index YAHAN MAT DALO - yeh unique field se automatically aa jayega

module.exports = mongoose.model("Coupon", couponSchema);
