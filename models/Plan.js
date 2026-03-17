const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      enum: ["monthly", "quarterly", "half_yearly", "yearly"], // ✅ UPDATED
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
      enum: [
        "Monthly Plan",
        "Quarterly Plan",
        "Half Yearly Plan",
        "Yearly Plan",
      ], // ✅ UPDATED
    },
    duration: {
      type: Number,
      required: true,
      enum: [30, 90, 180, 365], // ✅ UPDATED (180 added)
      description: "Plan duration in days",
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD"],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Razorpay specific fields
    razorpayPlanId: {
      type: String,
      sparse: true,
      unique: true,
    },
    razorpayPlanData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Plan features
    features: [
      {
        name: String,
        included: {
          type: Boolean,
          default: true,
        },
        limit: Number,
        description: String,
      },
    ],

    // Feature access mapping
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
    },

    // Trial settings
    trialDays: {
      type: Number,
      default: 0,
    },
    hasTrial: {
      type: Boolean,
      default: false,
    },

    // Billing cycle
    billingCycle: {
      type: Number,
      default: 1,
      description: "Number of billing cycles",
    },
    billingPeriod: {
      type: String,
      enum: ["month", "quarter", "year"],
      default: "month",
    },

    // Plan metadata
    popular: {
      type: Boolean,
      default: false,
    },
    recommended: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },

    // Description and marketing
    description: {
      type: String,
      default: "",
    },
    highlightText: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "📦",
    },
    colorCode: {
      type: String,
      default: "#3B82F6",
    },

    // Usage metrics
    totalSubscribers: {
      type: Number,
      default: 0,
    },
    activeSubscribers: {
      type: Number,
      default: 0,
    },
    revenueGenerated: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for discounted price
planSchema.virtual("discountedPrice").get(function () {
  if (this.discountPercentage > 0) {
    return this.price * (1 - this.discountPercentage / 100);
  }
  return this.price;
});

// Virtual for formatted price
planSchema.virtual("formattedPrice").get(function () {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: this.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(this.price);
});

// Virtual for formatted discounted price
planSchema.virtual("formattedDiscountedPrice").get(function () {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: this.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(this.discountedPrice);
});

// Virtual for savings percentage
planSchema.virtual("savingsPercentage").get(function () {
  if (this.name === "monthly") return 0;

  const monthlyPlanPrice = 999;
  let monthlyTotal = monthlyPlanPrice;

  if (this.name === "quarterly") {
    monthlyTotal = monthlyPlanPrice * 3;
  } else if (this.name === "half_yearly") {
    monthlyTotal = monthlyPlanPrice * 6;
  } else if (this.name === "yearly") {
    monthlyTotal = monthlyPlanPrice * 12;
  }

  if (monthlyTotal > this.price) {
    return Math.round(((monthlyTotal - this.price) / monthlyTotal) * 100);
  }
  return 0;
});

// Methods
planSchema.methods.incrementSubscribers = async function (increment = 1) {
  this.totalSubscribers += increment;
  this.activeSubscribers += increment;
  await this.save();
};

planSchema.methods.decrementSubscribers = async function (decrement = 1) {
  this.activeSubscribers = Math.max(0, this.activeSubscribers - decrement);
  await this.save();
};

planSchema.methods.addRevenue = async function (amount) {
  this.revenueGenerated += amount;
  await this.save();
};

planSchema.methods.getFeatureLimit = function (featureName) {
  return this.featureAccess[featureName] || 0;
};

planSchema.methods.hasFeature = function (featureName) {
  return !!this.featureAccess[featureName];
};

// Static methods
planSchema.statics.getActivePlans = function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
};

planSchema.statics.getPopularPlan = function () {
  return this.findOne({ popular: true, isActive: true });
};

planSchema.statics.getPlanByDuration = function (days) {
  return this.findOne({ duration: days, isActive: true });
};

planSchema.statics.getMonthlyPrice = async function () {
  const monthly = await this.findOne({ name: "monthly", isActive: true });
  return monthly ? monthly.price : 999;
};

// ✅ UPDATED: createDefaultPlans with half_yearly
planSchema.statics.createDefaultPlans = async function () {
  const defaultPlans = [
    {
      name: "monthly",
      displayName: "Monthly Plan",
      duration: 30,
      price: 999,
      discountPercentage: 0,
      trialDays: 7,
      hasTrial: true,
      popular: false,
      recommended: false,
      sortOrder: 1,
      features: [
        { name: "Basic CRM Features", included: true },
        { name: "Up to 100 Leads", included: true, limit: 100 },
        { name: "Up to 100 Contacts", included: true, limit: 100 },
        { name: "Email Support", included: true },
        { name: "Basic Reports", included: true },
      ],
      featureAccess: {
        maxUsers: 1,
        maxLeads: 100,
        maxContacts: 100,
        maxTasks: 50,
        maxProjects: 5,
        advancedReports: false,
        apiAccess: false,
        emailCampaigns: false,
        customFields: true,
      },
    },
    {
      name: "quarterly",
      displayName: "Quarterly Plan",
      duration: 90,
      price: 2697,
      discountPercentage: 10,
      trialDays: 7,
      hasTrial: true,
      popular: true,
      recommended: true,
      sortOrder: 2,
      features: [
        { name: "All Monthly Features", included: true },
        { name: "Up to 500 Leads", included: true, limit: 500 },
        { name: "Up to 500 Contacts", included: true, limit: 500 },
        { name: "Priority Email Support", included: true },
        { name: "Advanced Reports", included: true },
        { name: "Email Campaigns", included: true },
      ],
      featureAccess: {
        maxUsers: 3,
        maxLeads: 500,
        maxContacts: 500,
        maxTasks: 200,
        maxProjects: 15,
        advancedReports: true,
        apiAccess: false,
        emailCampaigns: true,
        customFields: true,
      },
    },
    {
      name: "half_yearly", // ✅ NEW PLAN
      displayName: "Half Yearly Plan",
      duration: 180,
      price: 5094,
      discountPercentage: 15,
      trialDays: 10,
      hasTrial: true,
      popular: false,
      recommended: true,
      sortOrder: 3,
      features: [
        { name: "All Quarterly Features", included: true },
        { name: "Up to 2000 Leads", included: true, limit: 2000 },
        { name: "Up to 2000 Contacts", included: true, limit: 2000 },
        { name: "API Access", included: true },
        { name: "Bulk Operations", included: true },
        { name: "Advanced Analytics", included: true },
      ],
      featureAccess: {
        maxUsers: 5,
        maxLeads: 2000,
        maxContacts: 2000,
        maxTasks: 500,
        maxProjects: 25,
        maxStorage: 10240,
        advancedReports: true,
        apiAccess: true,
        emailCampaigns: true,
        customFields: true,
        bulkOperations: true,
        prioritySupport: true,
        dataExport: true,
        teamCollaboration: true,
      },
    },
    {
      name: "yearly",
      displayName: "Yearly Plan",
      duration: 365,
      price: 8999,
      discountPercentage: 25,
      trialDays: 14,
      hasTrial: true,
      popular: false,
      recommended: true,
      sortOrder: 4, // ✅ UPDATED
      features: [
        { name: "All Quarterly Features", included: true },
        { name: "Unlimited Leads", included: true },
        { name: "Unlimited Contacts", included: true },
        { name: "API Access", included: true },
        { name: "Premium Support", included: true },
        { name: "Custom Development", included: false },
      ],
      featureAccess: {
        maxUsers: 10,
        maxLeads: 10000,
        maxContacts: 10000,
        maxTasks: 2000,
        maxProjects: 50,
        advancedReports: true,
        apiAccess: true,
        emailCampaigns: true,
        customFields: true,
      },
    },
  ];

  for (const planData of defaultPlans) {
    await this.findOneAndUpdate({ name: planData.name }, planData, {
      upsert: true,
      new: true,
    });
  }
};

module.exports = mongoose.model("Plan", planSchema);
