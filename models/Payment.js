const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },

    // ✅ Stripe-specific fields
    stripePaymentIntentId: {
      type: String,
      required: [true, "Stripe Payment Intent ID is required"],
      unique: true,
      sparse: true,
      index: true,
    },

    stripeCustomerId: {
      type: String,
      index: true,
    },

    stripeSubscriptionId: {
      type: String,
      index: true,
    },

    stripeInvoiceId: {
      type: String,
      index: true,
    },

    stripeChargeId: String,
    stripeRefundId: String,
    stripeCheckoutSessionId: String,
    clientSecret: String, // For frontend confirmation

    // Amount details (in cents/paisa - Stripe uses smallest currency unit)
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    amountRefunded: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "usd",
      enum: ["usd", "inr", "eur", "gbp"],
    },

    // Payment method
    paymentMethodType: {
      type: String,
      enum: [
        "card",
        "bank_transfer",
        "us_bank_account",
        "ideal",
        "google_pay",
        "apple_pay",
      ],
    },

    paymentMethodDetails: {
      card: {
        brand: String, // visa, mastercard, etc.
        last4: String,
        expMonth: Number,
        expYear: Number,
        fingerprint: String,
        country: String,
      },
      bankTransfer: {
        bankName: String,
        accountLast4: String,
      },
    },

    // Payment status (Stripe PaymentIntent statuses)
    status: {
      type: String,
      enum: [
        "requires_payment_method", // Initial state
        "requires_confirmation", // Needs confirmation
        "requires_action", // Needs 3D Secure etc.
        "processing", // Being processed
        "succeeded", // Payment successful
        "canceled", // Payment canceled
        "failed", // Payment failed
        "refunded", // Fully refunded
        "partially_refunded", // Partially refunded
      ],
      default: "requires_payment_method",
      index: true,
    },

    // Transaction IDs
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    balanceTransactionId: String, // Stripe balance transaction ID

    // Refund details
    refunds: [
      {
        stripeRefundId: String,
        amount: Number,
        status: {
          type: String,
          enum: ["pending", "succeeded", "failed"],
        },
        reason: String,
        initiatedBy: {
          type: String,
          enum: ["user", "admin", "system"],
        },
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Invoice
    invoiceNumber: String,
    invoiceUrl: String,
    invoicePdfUrl: String,

    // Tax details
    tax: {
      amount: Number,
      rate: Number,
      taxBreakdown: [
        {
          amount: Number,
          rate: Number,
          name: String,
          type: String, // gst, vat, etc.
        },
      ],
    },

    // Error handling
    error: {
      code: String,
      message: String,
      declineCode: String, // Specific decline codes from Stripe
      paymentMethod: String,
    },

    // Payment attempts
    attempts: {
      type: Number,
      default: 1,
    },
    lastAttemptAt: Date,

    // Webhook tracking
    webhookEvents: [
      {
        event: String, // payment_intent.succeeded, etc.
        payload: mongoose.Schema.Types.Mixed,
        receivedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Metadata
    metadata: {
      ip: String,
      userAgent: String,
      customerEmail: String,
      customerName: String,
      notes: mongoose.Schema.Types.Mixed,
    },

    // Billing details
    billingDetails: {
      name: String,
      email: String,
      phone: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
    },

    // Shipping details (if applicable)
    shippingDetails: {
      name: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
    },

    // Receipt
    receiptUrl: String,
    receiptSent: {
      type: Boolean,
      default: false,
    },
    receiptSentAt: Date,

    // Payment completion
    paidAt: Date,
    canceledAt: Date,
    refundedAt: Date,

    // For subscription payments
    isSubscription: {
      type: Boolean,
      default: false,
    },
    subscriptionCurrentPeriodStart: Date,
    subscriptionCurrentPeriodEnd: Date,
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
paymentSchema.index({ subscriptionId: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ stripeCustomerId: 1 });
paymentSchema.index({ stripeSubscriptionId: 1 });
paymentSchema.index({ "refunds.stripeRefundId": 1 });

// ============================================
// VIRTUALS
// ============================================
paymentSchema.virtual("isSuccessful").get(function () {
  return this.status === "succeeded";
});

paymentSchema.virtual("isFailed").get(function () {
  return ["failed", "canceled"].includes(this.status);
});

paymentSchema.virtual("isRefunded").get(function () {
  return ["refunded", "partially_refunded"].includes(this.status);
});

paymentSchema.virtual("requiresAction").get(function () {
  return this.status === "requires_action";
});

paymentSchema.virtual("refundableAmount").get(function () {
  return this.amountPaid - this.amountRefunded;
});

paymentSchema.virtual("formattedAmount").get(function () {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: this.currency,
    minimumFractionDigits: 2,
  }).format(this.amount / 100); // Stripe stores in cents/paisa
});

// ============================================
// METHODS
// ============================================
paymentSchema.methods.markSucceeded = async function (paymentData = {}) {
  this.status = "succeeded";
  this.amountPaid = this.amount;
  this.paidAt = paymentData.paidAt || new Date();

  if (paymentData.paymentMethodType) {
    this.paymentMethodType = paymentData.paymentMethodType;
  }

  if (paymentData.paymentMethodDetails) {
    this.paymentMethodDetails = paymentData.paymentMethodDetails;
  }

  await this.save();

  // Update subscription if linked
  if (this.subscriptionId) {
    const Subscription = mongoose.model("Subscription");
    await Subscription.findByIdAndUpdate(this.subscriptionId, {
      $push: {
        paymentHistory: {
          transactionId: this.transactionId,
          stripePaymentIntentId: this.stripePaymentIntentId,
          amount: this.amount,
          status: "succeeded",
          paymentMethod: this.paymentMethodType,
          date: this.paidAt,
        },
      },
      $set: {
        status: "active",
        lastWebhookReceived: new Date(),
        lastWebhookEvent: "payment_intent.succeeded",
        currentPeriodStart: this.subscriptionCurrentPeriodStart,
        currentPeriodEnd: this.subscriptionCurrentPeriodEnd,
      },
    });
  }
};

paymentSchema.methods.markFailed = async function (errorData = {}) {
  this.status = "failed";
  this.error = {
    code: errorData.code,
    message: errorData.message,
    declineCode: errorData.declineCode,
    paymentMethod: errorData.paymentMethod,
  };

  await this.save();

  // Update subscription if linked
  if (this.subscriptionId) {
    const Subscription = mongoose.model("Subscription");
    await Subscription.findByIdAndUpdate(this.subscriptionId, {
      $push: {
        paymentHistory: {
          transactionId: this.transactionId,
          stripePaymentIntentId: this.stripePaymentIntentId,
          amount: this.amount,
          status: "failed",
          errorMessage: errorData.message,
          date: new Date(),
        },
      },
      $set: {
        status: "incomplete",
        lastWebhookReceived: new Date(),
        lastWebhookEvent: "payment_intent.payment_failed",
      },
    });
  }
};

paymentSchema.methods.processRefund = async function (refundData) {
  const refundAmount = refundData.amount || this.amount;

  // Add to refunds array
  this.refunds.push({
    stripeRefundId: refundData.stripeRefundId,
    amount: refundAmount,
    status: refundData.status || "succeeded",
    reason: refundData.reason,
    initiatedBy: refundData.initiatedBy || "admin",
    metadata: refundData.metadata,
    createdAt: new Date(),
  });

  // Update refunded amount
  this.amountRefunded += refundAmount;

  // Update status
  if (this.amountRefunded >= this.amountPaid) {
    this.status = "refunded";
    this.refundedAt = new Date();
  } else if (this.amountRefunded > 0) {
    this.status = "partially_refunded";
  }

  await this.save();
  return this;
};

paymentSchema.methods.updatePaymentIntent = async function (updateData) {
  Object.assign(this, updateData);
  await this.save();
  return this;
};

paymentSchema.methods.addWebhookEvent = async function (event, payload) {
  this.webhookEvents.push({
    event,
    payload,
    receivedAt: new Date(),
  });

  await this.save();
};

// ============================================
// STATIC METHODS
// ============================================
paymentSchema.statics.getPaymentsByUser = function (userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("subscriptionId");
};

paymentSchema.statics.getPaymentStats = async function (userId = null) {
  const match = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};

  const stats = await this.aggregate([
    { $match: match },
    {
      $facet: {
        total: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: "$amount" },
              totalPaid: { $sum: "$amountPaid" },
              totalRefunded: { $sum: "$amountRefunded" },
            },
          },
        ],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byMethod: [
          { $group: { _id: "$paymentMethodType", count: { $sum: 1 } } },
        ],
        recent: [
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          {
            $project: {
              stripePaymentIntentId: 1,
              amount: 1,
              status: 1,
              paymentMethodType: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
  ]);

  return stats[0];
};

paymentSchema.statics.findByPaymentIntentId = function (paymentIntentId) {
  return this.findOne({ stripePaymentIntentId: paymentIntentId }).populate(
    "userId subscriptionId",
  );
};

paymentSchema.statics.findByCustomerId = function (customerId) {
  return this.find({ stripeCustomerId: customerId })
    .sort({ createdAt: -1 })
    .populate("userId subscriptionId");
};

paymentSchema.statics.findBySubscriptionId = function (subscriptionId) {
  return this.find({ stripeSubscriptionId: subscriptionId })
    .sort({ createdAt: -1 })
    .populate("userId subscriptionId");
};

paymentSchema.statics.findByCheckoutSessionId = function (sessionId) {
  return this.findOne({ stripeCheckoutSessionId: sessionId });
};

paymentSchema.statics.createFromWebhook = async function (event, data) {
  let paymentData = {};

  switch (event) {
    case "payment_intent.succeeded":
    case "payment_intent.created":
      paymentData = {
        stripePaymentIntentId: data.id,
        stripeCustomerId: data.customer,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        clientSecret: data.client_secret,
        paymentMethodType: data.payment_method_types?.[0],
        metadata: {
          customerEmail: data.receipt_email,
          notes: data.metadata,
        },
        paidAt: data.status === "succeeded" ? new Date() : null,
      };
      break;

    case "invoice.paid":
    case "invoice.payment_succeeded":
      paymentData = {
        stripeInvoiceId: data.id,
        stripeCustomerId: data.customer,
        stripeSubscriptionId: data.subscription,
        amount: data.amount_paid,
        currency: data.currency,
        status: "succeeded",
        invoiceNumber: data.number,
        invoiceUrl: data.hosted_invoice_url,
        invoicePdfUrl: data.invoice_pdf,
        paidAt: new Date(),
        isSubscription: true,
      };
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      paymentData = {
        stripeSubscriptionId: data.id,
        stripeCustomerId: data.customer,
        subscriptionCurrentPeriodStart: new Date(
          data.current_period_start * 1000,
        ),
        subscriptionCurrentPeriodEnd: new Date(data.current_period_end * 1000),
        isSubscription: true,
      };
      break;

    default:
      return null;
  }

  // Add user ID from metadata if available
  if (data.metadata?.userId) {
    paymentData.userId = data.metadata.userId;
  }
  if (data.metadata?.subscriptionId) {
    paymentData.subscriptionId = data.metadata.subscriptionId;
  }

  // Check if payment already exists
  let payment;
  if (data.id) {
    payment = await this.findByPaymentIntentId(data.id);
  }

  if (payment) {
    // Update existing payment
    Object.assign(payment, paymentData);
    await payment.save();
    return payment;
  } else {
    // Create new payment
    const newPayment = new this(paymentData);
    await newPayment.save();
    return newPayment;
  }
};

// ============================================
// MIDDLEWARE
// ============================================
paymentSchema.pre("save", function (next) {
  // Generate transaction ID if not present
  if (!this.transactionId) {
    this.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  next();
});

paymentSchema.post("save", function (doc) {
  // Log or perform actions after save
  if (doc.status === "succeeded") {
    console.log(`Payment succeeded: ${doc.stripePaymentIntentId}`);
  }
});

module.exports = mongoose.model("Payment", paymentSchema);
