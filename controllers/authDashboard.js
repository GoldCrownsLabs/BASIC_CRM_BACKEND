const mongoose = require("mongoose");

// Import existing models (except Activity)
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const Contact = require("../models/Contact");

// Import Activity model separately if it exists
let Activity;
try {
  Activity = require("../models/Activity");
} catch (error) {
  // If Activity model doesn't exist, create a simple one
  console.log("Activity model not found, using dummy");
  Activity = {
    find: () => ({
      sort: () => ({
        limit: () => ({
          populate: () => ({ exec: () => Promise.resolve([]) }),
        }),
      }),
    }),
    countDocuments: () => Promise.resolve(0),
  };
}

// Create DashboardStats model only
let DashboardStats;
try {
  DashboardStats = mongoose.model("DashboardStats");
} catch (error) {
  const dashboardStatsSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    totalLeads: { type: Number, default: 0 },
    activeLeads: { type: Number, default: 0 },
    wonLeads: { type: Number, default: 0 },
    totalContacts: { type: Number, default: 0 },
    pendingTasks: { type: Number, default: 0 },
    overdueTasks: { type: Number, default: 0 },
    recentActivities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Activity",
      },
    ],
    leadByStatus: {
      New: Number,
      Contacted: Number,
      Qualified: Number,
      Proposal: Number,
      Negotiation: Number,
      Won: Number,
      Lost: Number,
    },
    leadBySource: {
      Website: Number,
      Referral: Number,
      "Social Media": Number,
      Email: Number,
      Other: Number,
    },
    lastUpdated: { type: Date, default: Date.now },
  });
  DashboardStats = mongoose.model("DashboardStats", dashboardStatsSchema);
}

// Utility function for checking authentication
const isAuthenticated = (req) => {
  return req.user && req.user.id;
};

// Get Dashboard Summary
exports.getDashboardSummary = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;

    // Get counts in parallel (excluding Activity-related queries if Activity model doesn't exist)
    const queries = [
      // Total leads
      Lead.countDocuments({ createdBy: userId }),

      // Active leads (not Won or Lost)
      Lead.countDocuments({
        createdBy: userId,
        status: { $nin: ["Won", "Lost"] },
      }),

      // Won leads
      Lead.countDocuments({
        createdBy: userId,
        status: "Won",
      }),

      // Total contacts
      Contact.countDocuments({ createdBy: userId }),

      // Pending tasks
      Task.countDocuments({
        createdBy: userId,
        status: { $in: ["Pending", "In Progress"] },
      }),

      // Overdue tasks
      Task.countDocuments({
        createdBy: userId,
        status: { $in: ["Pending", "In Progress"] },
        dueDate: { $lt: new Date() },
      }),

      // Recent activities (last 10) - only if Activity model exists
      Activity && typeof Activity.find === "function"
        ? Activity.find({ createdBy: userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate("createdBy", "name email")
            .exec()
        : Promise.resolve([]),

      // Leads by status
      Lead.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Leads by source
      Lead.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
    ];

    const [
      totalLeads,
      activeLeads,
      wonLeads,
      totalContacts,
      pendingTasks,
      overdueTasks,
      recentActivities,
      leadByStatus,
      leadBySource,
    ] = await Promise.all(queries);

    // Convert leadByStatus array to object
    const leadByStatusObj = {};
    if (leadByStatus && Array.isArray(leadByStatus)) {
      leadByStatus.forEach((item) => {
        leadByStatusObj[item._id] = item.count;
      });
    }

    // Convert leadBySource array to object
    const leadBySourceObj = {};
    if (leadBySource && Array.isArray(leadBySource)) {
      leadBySource.forEach((item) => {
        leadBySourceObj[item._id] = item.count;
      });
    }

    // Update or create dashboard stats
    if (DashboardStats) {
      await DashboardStats.findOneAndUpdate(
        { userId },
        {
          userId,
          totalLeads,
          activeLeads,
          wonLeads,
          totalContacts,
          pendingTasks,
          overdueTasks,
          recentActivities:
            recentActivities && Array.isArray(recentActivities)
              ? recentActivities.map((activity) => activity._id)
              : [],
          leadByStatus: leadByStatusObj,
          leadBySource: leadBySourceObj,
          lastUpdated: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalLeads,
          activeLeads,
          wonLeads,
          totalContacts,
          pendingTasks,
          overdueTasks,
          conversionRate:
            totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(2) : 0,
        },
        recentActivities: recentActivities || [],
        leadByStatus: leadByStatusObj,
        leadBySource: leadBySourceObj,
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
      error: error.message,
    });
  }
};

// Get Recent Items (Leads, Tasks, Contacts, Activities)
exports.getRecentItems = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    const queries = [
      Lead.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("assignedTo", "name email")
        .exec(),

      Task.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("assignedTo", "name email")
        .exec(),

      Contact.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec(),
    ];

    // Add Activity query only if Activity model exists
    if (Activity && typeof Activity.find === "function") {
      queries.push(
        Activity.find({ createdBy: userId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("createdBy", "name email")
          .populate("participants", "name email")
          .exec()
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    const [recentLeads, recentTasks, recentContacts, recentActivities] =
      await Promise.all(queries);

    res.json({
      success: true,
      data: {
        recentLeads,
        recentTasks,
        recentContacts,
        recentActivities: recentActivities || [],
      },
    });
  } catch (error) {
    console.error("Recent items error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent items",
      error: error.message,
    });
  }
};

// Get Activity Timeline (Simplified version without Activity model)
exports.getActivityTimeline = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // If Activity model doesn't exist, return empty timeline
    if (!Activity || typeof Activity.find !== "function") {
      return res.json({
        success: true,
        data: {
          timeline: {},
          totalActivities: 0,
          message: "Activity model not available",
        },
      });
    }

    const activities = await Activity.find({
      createdBy: userId,
      createdAt: { $gte: startDate },
    })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email")
      .exec();

    // Group activities by date
    const timeline = {};
    if (activities && Array.isArray(activities)) {
      activities.forEach((activity) => {
        if (activity && activity.createdAt) {
          const date = activity.createdAt.toISOString().split("T")[0];
          if (!timeline[date]) {
            timeline[date] = [];
          }
          timeline[date].push(activity);
        }
      });
    }

    res.json({
      success: true,
      data: {
        timeline,
        totalActivities: activities ? activities.length : 0,
      },
    });
  } catch (error) {
    console.error("Activity timeline error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity timeline",
      error: error.message,
    });
  }
};

// Get Performance Metrics
exports.getPerformanceMetrics = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const period = req.query.period || "month";

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "day":
        startDate.setDate(startDate.getDate() - 1);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Get lead conversion metrics
    const leadMetrics = await Lead.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
          totalValue: { $sum: "$value" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          totalLeads: { $sum: "$count" },
          wonLeads: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "Won"] }, "$count", 0],
            },
          },
          totalValue: { $sum: "$totalValue" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get task completion metrics
    const taskMetrics = await Task.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          totalTasks: { $sum: "$count" },
          completedTasks: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "Completed"] }, "$count", 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        leadMetrics,
        taskMetrics,
        summary: {
          totalLeadsPeriod: leadMetrics.reduce(
            (sum, item) => sum + (item.totalLeads || 0),
            0
          ),
          wonLeadsPeriod: leadMetrics.reduce(
            (sum, item) => sum + (item.wonLeads || 0),
            0
          ),
          conversionRatePeriod:
            leadMetrics.reduce((sum, item) => sum + (item.totalLeads || 0), 0) >
            0
              ? (
                  (leadMetrics.reduce(
                    (sum, item) => sum + (item.wonLeads || 0),
                    0
                  ) /
                    leadMetrics.reduce(
                      (sum, item) => sum + (item.totalLeads || 0),
                      0
                    )) *
                  100
                ).toFixed(2)
              : 0,
          totalTasksPeriod: taskMetrics.reduce(
            (sum, item) => sum + (item.totalTasks || 0),
            0
          ),
          completedTasksPeriod: taskMetrics.reduce(
            (sum, item) => sum + (item.completedTasks || 0),
            0
          ),
          completionRatePeriod:
            taskMetrics.reduce((sum, item) => sum + (item.totalTasks || 0), 0) >
            0
              ? (
                  (taskMetrics.reduce(
                    (sum, item) => sum + (item.completedTasks || 0),
                    0
                  ) /
                    taskMetrics.reduce(
                      (sum, item) => sum + (item.totalTasks || 0),
                      0
                    )) *
                  100
                ).toFixed(2)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Performance metrics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching performance metrics",
      error: error.message,
    });
  }
};

// Quick Stats for Dashboard Cards
exports.getQuickStats = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;

    // Get all stats in parallel
    const [
      totalLeads,
      activeLeads,
      wonLeads,
      totalContacts,
      pendingTasks,
      overdueTasks,
      totalTasks,
      completedTasks,
    ] = await Promise.all([
      Lead.countDocuments({ createdBy: userId }),
      Lead.countDocuments({
        createdBy: userId,
        status: { $nin: ["Won", "Lost"] },
      }),
      Lead.countDocuments({
        createdBy: userId,
        status: "Won",
      }),
      Contact.countDocuments({ createdBy: userId }),
      Task.countDocuments({
        createdBy: userId,
        status: { $in: ["Pending", "In Progress"] },
      }),
      Task.countDocuments({
        createdBy: userId,
        status: { $in: ["Pending", "In Progress"] },
        dueDate: { $lt: new Date() },
      }),
      Task.countDocuments({ createdBy: userId }),
      Task.countDocuments({
        createdBy: userId,
        status: "Completed",
      }),
    ]);

    const conversionRate =
      totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(2) : 0;

    const taskCompletionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;

    // Get leads by status
    const leadStatusAgg = await Lead.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const leadByStatus = {};
    if (leadStatusAgg && Array.isArray(leadStatusAgg)) {
      leadStatusAgg.forEach((item) => {
        leadByStatus[item._id] = item.count;
      });
    }

    // Get leads by source
    const leadSourceAgg = await Lead.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]);

    const leadBySource = {};
    if (leadSourceAgg && Array.isArray(leadSourceAgg)) {
      leadSourceAgg.forEach((item) => {
        leadBySource[item._id] = item.count;
      });
    }

    res.json({
      success: true,
      data: {
        totalLeads,
        activeLeads,
        wonLeads,
        totalContacts,
        pendingTasks,
        overdueTasks,
        conversionRate,
        taskCompletionRate,
        leadByStatus,
        leadBySource,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error("Quick stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quick stats",
      error: error.message,
    });
  }
};

// Search across all entities
exports.searchDashboard = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const query = req.query.q;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long",
      });
    }

    const searchRegex = new RegExp(query, "i");

    const queries = [
      Lead.find({
        createdBy: userId,
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { company: searchRegex },
          { notes: searchRegex },
        ],
      }).limit(10),

      Task.find({
        createdBy: userId,
        $or: [{ title: searchRegex }, { description: searchRegex }],
      }).limit(10),

      Contact.find({
        createdBy: userId,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { company: searchRegex },
          { jobTitle: searchRegex },
        ],
      }).limit(10),
    ];

    // Add Activity search only if Activity model exists
    if (Activity && typeof Activity.find === "function") {
      queries.push(
        Activity.find({
          createdBy: userId,
          $or: [{ title: searchRegex }, { description: searchRegex }],
        }).limit(10)
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    const [leads, tasks, contacts, activities] = await Promise.all(queries);

    res.json({
      success: true,
      data: {
        leads: leads || [],
        tasks: tasks || [],
        contacts: contacts || [],
        activities: activities || [],
        totalResults:
          (leads ? leads.length : 0) +
          (tasks ? tasks.length : 0) +
          (contacts ? contacts.length : 0) +
          (activities ? activities.length : 0),
      },
    });
  } catch (error) {
    console.error("Dashboard search error:", error);
    res.status(500).json({
      success: false,
      message: "Error performing search",
      error: error.message,
    });
  }
};
