const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: [true, "Plan ID is required"],
    },

    // ✅ Razorpay fields with proper indexing
    razorpaySubscriptionId: {
      type: String,
      sparse: true,
      unique: true,
      index: true, // ✅ Index only here, not in schema.index()
    },

    razorpayOrderId: {
      type: String,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
    },
    razorpayCustomerId: String,

    // Date fields
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    trialStartDate: Date,
    trialEndDate: Date,
    cancelledAt: Date,
    activatedAt: Date,
    expiredAt: Date,
    gracePeriodEndsAt: Date,

    // Status
    status: {
      type: String,
      enum: [
        "pending", // Initial state
        "trial", // In trial period
        "active", // Active subscription
        "expired", // Subscription expired
        "cancelled", // User cancelled
        "failed", // Payment failed
        "paused", // Temporarily paused
        "suspended", // Suspended by admin
        "completed", // Completed all cycles
      ],
      default: "pending",
      index: true,
    },

    // Payment details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    discountApplied: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },

    // Billing cycle
    billingCycle: {
      current: {
        type: Number,
        default: 1,
      },
      total: {
        type: Number,
        required: true,
      },
      period: {
        type: String,
        enum: ["month", "quarter", "year"],
        default: "month",
      },
    },

    // Payment history
    paymentHistory: [
      {
        transactionId: String,
        razorpayPaymentId: String,
        amount: Number,
        status: {
          type: String,
          enum: ["initiated", "processing", "success", "failed", "refunded"],
        },
        paymentMethod: String,
        paymentMethodDetails: {
          type: String,
          enum: ["card", "upi", "netbanking", "wallet"],
        },
        invoiceId: String,
        invoiceUrl: String,
        errorMessage: String,
        errorCode: String,
        metadata: mongoose.Schema.Types.Mixed,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Invoices
    invoices: [
      {
        invoiceNumber: String,
        razorpayInvoiceId: String,
        amount: Number,
        tax: Number,
        total: Number,
        status: {
          type: String,
          enum: ["generated", "sent", "paid", "overdue"],
        },
        url: String,
        pdfUrl: String,
        generatedAt: Date,
        paidAt: Date,
        dueDate: Date,
      },
    ],

    // Trial tracking
    trialPeriod: {
      type: Number,
      default: 0,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    trialConverted: {
      type: Boolean,
      default: false,
    },
    trialAuthTransactionId: String,

    // Auto-renewal
    autoRenew: {
      type: Boolean,
      default: true,
    },
    autoRenewFailedAttempts: {
      type: Number,
      default: 0,
    },
    lastAutoRenewAttempt: Date,

    // Cancellation
    cancellationReason: String,
    cancelledBy: {
      type: String,
      enum: ["user", "admin", "system"],
    },

    // Snapshots
    featureAccessSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    planSnapshot: {
      name: String,
      price: Number,
      features: [mongoose.Schema.Types.Mixed],
    },

    // Webhook tracking
    lastWebhookReceived: Date,
    lastWebhookEvent: String,

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Admin notes
    notes: [
      {
        text: String,
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================
// ✅ INDEXES - No duplicates (all in one place)
// ============================================
// Note: razorpaySubscriptionId index is already in schema field
// So it's NOT included here

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ "paymentHistory.date": -1 });
subscriptionSchema.index({ createdAt: -1 });

// ============================================
// VIRTUALS
// ============================================
subscriptionSchema.virtual("isActive").get(function () {
  const now = new Date();
  return ["active", "trial"].includes(this.status) && this.endDate > now;
});

subscriptionSchema.virtual("isInTrial").get(function () {
  const now = new Date();
  return (
    this.status === "trial" && this.trialEndDate && this.trialEndDate > now
  );
});

subscriptionSchema.virtual("daysRemaining").get(function () {
  const now = new Date();
  if (this.endDate <= now) return 0;
  const diff = this.endDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

subscriptionSchema.virtual("totalPaid").get(function () {
  return this.paymentHistory
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + p.amount, 0);
});

subscriptionSchema.virtual("lastPayment").get(function () {
  const payments = this.paymentHistory
    .filter((p) => p.status === "success")
    .sort((a, b) => b.date - a.date);
  return payments[0] || null;
});

// ============================================
// METHODS
// ============================================
subscriptionSchema.methods.activate = async function () {
  this.status = "active";
  this.activatedAt = new Date();
  await this.save();

  // Update user's current subscription
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(this.userId, {
    currentSubscription: this._id,
  });
};

subscriptionSchema.methods.startTrial = async function (trialDays) {
  const now = new Date();
  this.status = "trial";
  this.trialStartDate = now;
  this.trialEndDate = new Date(now.setDate(now.getDate() + trialDays));
  this.trialUsed = true;
  await this.save();
};

subscriptionSchema.methods.convertTrialToPaid = async function () {
  this.trialConverted = true;
  this.status = "active";
  await this.save();
};

subscriptionSchema.methods.cancel = async function (
  reason,
  cancelledBy = "user",
) {
  this.status = "cancelled";
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.autoRenew = false;
  await this.save();

  // Remove from user's current subscription
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(this.userId, {
    $unset: { currentSubscription: 1 },
  });
};

subscriptionSchema.methods.expire = async function () {
  this.status = "expired";
  this.expiredAt = new Date();
  this.autoRenew = false;
  await this.save();

  // Remove from user's current subscription
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(this.userId, {
    $unset: { currentSubscription: 1 },
  });
};

subscriptionSchema.methods.addPayment = async function (paymentData) {
  this.paymentHistory.push({
    ...paymentData,
    date: new Date(),
  });

  if (paymentData.status === "success") {
    this.paidAmount = (this.paidAmount || 0) + paymentData.amount;
    this.status = "active";
  }

  await this.save();
  return this;
};

subscriptionSchema.methods.generateInvoice = async function () {
  const invoiceNumber = `INV-${Date.now()}-${this._id.toString().slice(-4)}`;

  const invoice = {
    invoiceNumber,
    amount: this.amount,
    tax: this.taxAmount,
    total: this.amount + this.taxAmount,
    status: "generated",
    generatedAt: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };

  this.invoices.push(invoice);
  await this.save();

  return invoice;
};

subscriptionSchema.methods.checkAndRenew = async function () {
  const now = new Date();

  if (!this.autoRenew || this.status !== "active") {
    return false;
  }

  if (this.endDate <= now) {
    this.billingCycle.current += 1;

    if (this.billingCycle.current > this.billingCycle.total) {
      await this.expire();
      return false;
    }

    // Calculate new end date
    const newEndDate = new Date(this.endDate);
    if (this.billingCycle.period === "month") {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else if (this.billingCycle.period === "quarter") {
      newEndDate.setMonth(newEndDate.getMonth() + 3);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    this.endDate = newEndDate;
    await this.save();

    return true;
  }

  return false;
};

// ============================================
// STATIC METHODS
// ============================================
subscriptionSchema.statics.getActiveSubscriptions = function () {
  const now = new Date();
  return this.find({
    status: { $in: ["active", "trial"] },
    endDate: { $gt: now },
  }).populate("userId planId");
};

subscriptionSchema.statics.getExpiringSoon = function (days = 7) {
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  return this.find({
    status: "active",
    endDate: { $lte: expiryDate, $gt: now },
    autoRenew: true,
  }).populate("userId planId");
};

subscriptionSchema.statics.getSubscriptionStats = async function () {
  const now = new Date();

  const stats = await this.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        active: [
          {
            $match: {
              status: { $in: ["active", "trial"] },
              endDate: { $gt: now },
            },
          },
          { $count: "count" },
        ],
        revenue: [
          { $match: { status: "active" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ],
      },
    },
  ]);

  return stats[0];
};

subscriptionSchema.statics.findByUser = function (userId) {
  return this.find({ userId }).populate("planId").sort({ createdAt: -1 });
};

subscriptionSchema.statics.findByRazorpayId = function (
  razorpaySubscriptionId,
) {
  return this.findOne({ razorpaySubscriptionId }).populate("userId planId");
};

// ============================================
// MIDDLEWARE
// ============================================
subscriptionSchema.pre("save", function (next) {
  // Take plan snapshot when creating subscription
  if (this.isNew && this.planId) {
    mongoose
      .model("Plan")
      .findById(this.planId)
      .then((plan) => {
        if (plan) {
          this.planSnapshot = {
            name: plan.name,
            price: plan.price,
            features: plan.features,
          };
          this.featureAccessSnapshot = plan.featureAccess;
        }
        next();
      })
      .catch(next);
  } else {
    next();
  }
});

subscriptionSchema.post("save", async function (doc) {
  // Update plan statistics
  if (doc.isNew && doc.planId) {
    const Plan = mongoose.model("Plan");
    await Plan.findByIdAndUpdate(doc.planId, {
      $inc: { totalSubscribers: 1, activeSubscribers: 1 },
    });
  }
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
