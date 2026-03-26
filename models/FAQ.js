const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      unique: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Contacts",
        "Calendar",
        "General",
        "Data",
        "Tasks",
        "Security",
        "Activities",
        "Dashboard",
      ],
      required: true,
      index: true,
    },
    icon: {
      type: String,
      default: "help-circle",
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    helpful: {
      type: Number,
      default: 0,
    },
    notHelpful: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: [String],
    metadata: {
      views: {
        type: Number,
        default: 0,
      },
      lastViewed: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook to ensure unique ID
faqSchema.pre("save", async function (next) {
  if (!this.id) {
    const lastFAQ = await this.constructor.findOne().sort({ id: -1 });
    this.id = lastFAQ ? lastFAQ.id + 1 : 1;
  }
  next();
});

// Method to increment views
faqSchema.methods.incrementViews = async function () {
  this.metadata.views += 1;
  this.metadata.lastViewed = new Date();
  return this.save();
};

// Method to mark as helpful
faqSchema.methods.markHelpful = async function () {
  this.helpful += 1;
  return this.save();
};

// Method to mark as not helpful
faqSchema.methods.markNotHelpful = async function () {
  this.notHelpful += 1;
  return this.save();
};

// Static method to search FAQs
faqSchema.statics.search = async function (query, category = null) {
  let searchQuery = {};

  if (query) {
    searchQuery.$text = { $search: query };
  }

  if (category) {
    searchQuery.category = category;
  }

  searchQuery.isActive = true;

  return this.find(searchQuery).sort({ order: 1, helpful: -1 }).limit(20);
};

// Static method to get categories with counts
faqSchema.statics.getCategoriesWithCounts = async function () {
  const categories = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        icon: { $first: "$icon" },
      },
    },
    {
      $project: {
        id: "$_id",
        name: "$_id",
        count: 1,
        icon: 1,
        _id: 0,
      },
    },
    { $sort: { name: 1 } },
  ]);

  return categories;
};

const FAQ = mongoose.model("FAQ", faqSchema);

module.exports = FAQ;
