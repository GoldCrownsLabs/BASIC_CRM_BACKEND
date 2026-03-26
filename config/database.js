// config/db.js

const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const FAQ = require("../models/FAQ");
const Chat = require("../models/Chat"); // ✅ Import Chat model

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

// ✅ Default FAQs data with IDs
const defaultFAQs = [
  {
    id: 1,
    question: "How do I add a new contact?",
    answer:
      "Go to the Contacts tab and tap the + button. Fill in the contact details and save.",
    category: "Contacts",
    icon: "user-plus",
    order: 1,
    tags: ["contacts", "add", "create"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 2,
    question: "How to schedule a meeting?",
    answer:
      "Open the Calendar tab, select a date, tap Add Event, choose Meeting type, and fill in the details.",
    category: "Calendar",
    icon: "calendar",
    order: 2,
    tags: ["meeting", "calendar", "schedule"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 3,
    question: "Can I use the app offline?",
    answer:
      "Yes! All basic features work offline. Your data will sync when you reconnect to the internet.",
    category: "General",
    icon: "wifi-off",
    order: 3,
    tags: ["offline", "sync", "internet"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 4,
    question: "How to export my data?",
    answer: "Go to Settings > Export Data. You can export as CSV or PDF.",
    category: "Data",
    icon: "download",
    order: 4,
    tags: ["export", "backup", "data"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 5,
    question: "How to set reminders for tasks?",
    answer:
      "When creating a task, enable notifications and set your preferred reminder time.",
    category: "Tasks",
    icon: "bell",
    order: 5,
    tags: ["reminder", "task", "notification"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 6,
    question: "Is my data secure?",
    answer:
      "Yes, all data is encrypted and stored securely. We use industry-standard security practices.",
    category: "Security",
    icon: "shield",
    order: 6,
    tags: ["security", "encryption", "privacy"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 7,
    question: "How to filter activities?",
    answer:
      "Use the filter chips on the Activities page or the search bar to find specific activities.",
    category: "Activities",
    icon: "filter",
    order: 7,
    tags: ["activities", "filter", "search"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
  {
    id: 8,
    question: "Can I customize the dashboard?",
    answer:
      "Currently, the dashboard shows key metrics. More customization options are coming soon.",
    category: "Dashboard",
    icon: "layout",
    order: 8,
    tags: ["dashboard", "customize", "layout"],
    isActive: true,
    helpful: 0,
    notHelpful: 0,
    metadata: { views: 0 },
  },
];

// ✅ Function to create default FAQs
const createDefaultFAQs = async () => {
  try {
    console.log("📚 Checking for default FAQs...");

    // First, check if any FAQs exist
    const count = await FAQ.countDocuments();

    if (count === 0) {
      console.log("📚 No FAQs found. Seeding default FAQs...");

      // Insert all FAQs
      await FAQ.insertMany(defaultFAQs);
      console.log(`✅ Created ${defaultFAQs.length} FAQs successfully`);

      // Verify insertion
      const newCount = await FAQ.countDocuments();
      console.log(`📊 Total FAQs in database: ${newCount}`);
    } else {
      console.log(`📊 ${count} FAQs already exist in database`);

      // Optional: Update existing FAQs if needed
      for (const faqData of defaultFAQs) {
        const existing = await FAQ.findOne({ id: faqData.id });
        if (!existing) {
          await FAQ.create(faqData);
          console.log(
            `✅ Added missing FAQ: ${faqData.question.substring(0, 50)}...`,
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ Error creating default FAQs:", error.message);
  }
};

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

// ✅ Function to create indexes for better performance
const createDatabaseIndexes = async () => {
  try {
    console.log("🔍 Creating database indexes...");

    /* =========================
       Support Collection Indexes
    ========================= */
    try {
      const Support = mongoose.model("Support");

      await Support.collection.createIndex({ ticketId: 1 }, { unique: true });
      await Support.collection.createIndex({ userId: 1 });
      await Support.collection.createIndex({ email: 1 });
      await Support.collection.createIndex({ status: 1 });
      await Support.collection.createIndex({ type: 1 });
      await Support.collection.createIndex({ createdAt: -1 });

      console.log("✅ Support collection indexes created");
    } catch (error) {
      console.log("ℹ️ Support collection not found, skipping indexes");
    }

    /* =========================
       FAQ Collection Indexes
    ========================= */
    try {
      await FAQ.collection.createIndex({ category: 1 });
      await FAQ.collection.createIndex({ question: "text", answer: "text" });
      await FAQ.collection.createIndex({ id: 1 }, { unique: true });
      await FAQ.collection.createIndex({ order: 1 });

      console.log("✅ FAQ collection indexes created");
    } catch (error) {
      console.log("ℹ️ FAQ collection not found, skipping indexes");
    }

    /* =========================
       NOTE:
       Chat indexes are handled in Chat schema
       DO NOT create here
    ========================= */

    console.log("✅ Database indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating indexes:", error.message);
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

    // ✅ Call all initialization functions
    await createDefaultPlans();
    await createDefaultFAQs();
    await createDatabaseIndexes();

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
