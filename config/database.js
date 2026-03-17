const mongoose = require("mongoose");
const Plan = require("../models/Plan"); // ✅ Import Plan model

// ✅ Default plans data
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
    sortOrder: 1,
    billingCycle: 12,
    billingPeriod: "month",
    currency: "INR",
    features: [
      { name: "Basic CRM Features", included: true },
      { name: "Up to 100 Leads", included: true, limit: 100 },
      { name: "Up to 100 Contacts", included: true, limit: 100 },
      { name: "Up to 50 Tasks", included: true, limit: 50 },
      { name: "Email Support", included: true },
    ],
    featureAccess: {
      maxUsers: 1,
      maxLeads: 100,
      maxContacts: 100,
      maxTasks: 50,
      maxProjects: 5,
      maxStorage: 1024,
      advancedReports: false,
      apiAccess: false,
      emailCampaigns: false,
      customFields: true,
      bulkOperations: false,
      prioritySupport: false,
      dataExport: true,
      teamCollaboration: false,
      whiteLabel: false,
    },
    isActive: true,
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
    sortOrder: 2,
    billingCycle: 4,
    billingPeriod: "quarter",
    currency: "INR",
    features: [
      { name: "All Monthly Features", included: true },
      { name: "Up to 500 Leads", included: true, limit: 500 },
      { name: "Up to 500 Contacts", included: true, limit: 500 },
      { name: "Up to 200 Tasks", included: true, limit: 200 },
      { name: "Up to 15 Projects", included: true, limit: 15 },
      { name: "Advanced Reports", included: true },
      { name: "Email Campaigns", included: true },
      { name: "Priority Email Support", included: true },
    ],
    featureAccess: {
      maxUsers: 3,
      maxLeads: 500,
      maxContacts: 500,
      maxTasks: 200,
      maxProjects: 15,
      maxStorage: 5120,
      advancedReports: true,
      apiAccess: false,
      emailCampaigns: true,
      customFields: true,
      bulkOperations: true,
      prioritySupport: true,
      dataExport: true,
      teamCollaboration: true,
      whiteLabel: false,
    },
    isActive: true,
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
    sortOrder: 3,
    billingCycle: 1,
    billingPeriod: "year",
    currency: "INR",
    features: [
      { name: "All Quarterly Features", included: true },
      { name: "Unlimited Leads", included: true },
      { name: "Unlimited Contacts", included: true },
      { name: "Unlimited Tasks", included: true },
      { name: "Up to 50 Projects", included: true, limit: 50 },
      { name: "API Access", included: true },
      { name: "Premium Support", included: true },
      { name: "Advanced Analytics", included: true },
    ],
    featureAccess: {
      maxUsers: 10,
      maxLeads: 10000,
      maxContacts: 10000,
      maxTasks: 2000,
      maxProjects: 50,
      maxStorage: 10240,
      advancedReports: true,
      apiAccess: true,
      emailCampaigns: true,
      customFields: true,
      bulkOperations: true,
      prioritySupport: true,
      dataExport: true,
      teamCollaboration: true,
      whiteLabel: true,
    },
    isActive: true,
  },
];

// ✅ Function to create default plans
const createDefaultPlans = async () => {
  try {
    console.log("📋 Checking for default plans...");

    let createdCount = 0;
    let existingCount = 0;

    for (const planData of defaultPlans) {
      // Check if plan already exists
      const existing = await Plan.findOne({ name: planData.name });

      if (!existing) {
        await Plan.create(planData);
        createdCount++;
        console.log(`✅ Created plan: ${planData.displayName}`);
      } else {
        existingCount++;
        console.log(`⚠️ Plan already exists: ${planData.displayName}`);
      }
    }

    if (createdCount > 0) {
      console.log(`✅ ${createdCount} new plans created successfully`);
    }
    if (existingCount > 0) {
      console.log(`📊 ${existingCount} plans already exist in database`);
    }

    // ✅ Optional: Create Razorpay plans if not exists
    try {
      const razorpay = require("./razorpay");
      const plans = await Plan.find({
        isActive: true,
        razorpayPlanId: { $exists: false },
      });

      for (const plan of plans) {
        const razorpayPlan = await razorpay.plans.create({
          period: plan.billingPeriod,
          interval: 1,
          item: {
            name: plan.displayName,
            amount: plan.price * 100, // in paise
            currency: plan.currency || "INR",
          },
        });

        plan.razorpayPlanId = razorpayPlan.id;
        await plan.save();
        console.log(`✅ Created Razorpay plan for: ${plan.displayName}`);
      }
    } catch (razorpayError) {
      // Razorpay not configured - ignore in development
      console.log("ℹ️ Razorpay plan creation skipped (test mode OK)");
    }
  } catch (error) {
    console.error("❌ Error creating default plans:", error.message);
  }
};

const connectDB = async () => {
  try {
    console.log("🌐 Connecting to MongoDB Atlas Cloud...");

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // ✅ Call createDefaultPlans after successful connection
    await createDefaultPlans();

    // Connection events
    mongoose.connection.on("connected", () => {
      console.log("✅ Mongoose connected to Atlas");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ Mongoose connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ Mongoose disconnected");
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔌 MongoDB connection closed due to app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Failed: ${error.message}`);
    console.log("🔄 Retrying in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
