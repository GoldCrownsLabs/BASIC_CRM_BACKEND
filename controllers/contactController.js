const Contact = require("../models/Contact");
const User = require("../models/User");
const mongoose = require("mongoose"); // ✅ IMPORTANT: Add this
// ✅ FIX: Use new modular notification service
const Notification = require("../services/notifications");

// ===============================
// @desc    Get all contacts with pagination and filters
// @route   GET /api/contacts
// @access  Private
// ===============================
const getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      sort = "-createdAt",
      company,
      tag,
      leadStatus,
      connected,
      completed,
      isFavorite,
      source,
      minDealValue,
      maxDealValue,
      dateFrom,
      dateTo,
    } = req.query;

    // Validate and sanitize inputs
    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 100);

    // ✅ FIX: Add more sort fields
    const allowedSortFields = [
      "firstName",
      "lastName",
      "email",
      "company",
      "createdAt",
      "lastModified",
      "dealValue",
      "leadStatus",
      "connectedAt",
      "completedAt",
      "updatedAt", // ✅ Added
    ];

    let sortField = sort.replace(/^-/, "");
    let sortOrder = sort.startsWith("-") ? -1 : 1;

    if (!allowedSortFields.includes(sortField)) {
      sortField = "createdAt";
      sortOrder = -1;
    }

    // Build query
    let query = {
      userId: new mongoose.Types.ObjectId(req.user.id), // ✅ FIX: Use ObjectId
      isDeleted: false,
    };

    // Search functionality - ✅ IMPROVED
    if (search && search.trim()) {
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
        { tags: { $in: [searchRegex] } }, // ✅ FIX: Better tag search
        { leadStatus: searchRegex },
        { "address.city": searchRegex }, // ✅ Added address search
        { "address.country": searchRegex },
        { notes: searchRegex },
      ];
    }

    // Filter by lead status - ✅ IMPROVED validation
    if (leadStatus && leadStatus.trim()) {
      const validStatuses = ["cold", "warm", "hot", "connected", "completed"];
      const statuses = leadStatus.split(",").map((s) => s.trim());
      const validStatusArray = statuses.filter((s) =>
        validStatuses.includes(s),
      );

      if (validStatusArray.length === 1) {
        query.leadStatus = validStatusArray[0];
      } else if (validStatusArray.length > 1) {
        query.leadStatus = { $in: validStatusArray };
      }
    }

    // Filter by connected/completed
    if (connected !== undefined) {
      query.connected = connected === "true" || connected === true;
    }

    if (completed !== undefined) {
      query.completed = completed === "true" || completed === true;
    }

    // Filter by deal value range - ✅ FIX: Better handling
    if (minDealValue !== undefined || maxDealValue !== undefined) {
      // Don't force completed=true, completed deals will have dealValue > 0 anyway
      query.dealValue = {};
      if (minDealValue !== undefined && minDealValue !== "") {
        query.dealValue.$gte = parseFloat(minDealValue);
      }
      if (maxDealValue !== undefined && maxDealValue !== "") {
        query.dealValue.$lte = parseFloat(maxDealValue);
      }
    }

    // Filter by date range - ✅ IMPROVED
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    // Filter by company - ✅ IMPROVED
    if (company && company.trim()) {
      // Support multiple companies
      const companies = company
        .split(",")
        .map((c) => new RegExp(`^${c.trim()}$`, "i"));
      query.company =
        companies.length === 1 ? companies[0] : { $in: companies };
    }

    // Filter by tag - ✅ IMPROVED (support multiple tags)
    if (tag && tag.trim()) {
      const tags = tag.split(",").map((t) => t.trim());
      query.tags = { $all: tags }; // Contact must have ALL these tags
    }

    // Filter by favorite
    if (isFavorite !== undefined) {
      query.isFavorite = isFavorite === "true" || isFavorite === true;
    }

    // Filter by source - ✅ IMPROVED (support multiple sources)
    if (source && source.trim()) {
      const sources = source.split(",").map((s) => s.trim());
      query.source = sources.length === 1 ? sources[0] : { $in: sources };
    }

    // Get contacts with pagination
    const contacts = await Contact.find(query)
      .sort({ [sortField]: sortOrder })
      .select("-__v")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(); // ✅ Use lean() for better performance

    // Get total count
    const total = await Contact.countDocuments(query);

    // Get summary statistics
    const stats = await getFilterStats(query, req.user.id);

    // ✅ ADD: Add completion percentage to each contact
    const contactsWithCompletion = contacts.map((contact) => ({
      ...contact,
      completionPercentage: calculateContactCompletion(contact),
    }));

    res.status(200).json({
      success: true,
      count: contactsWithCompletion.length,
      data: contactsWithCompletion,
      stats,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching contacts",
    });
  }
};

// ✅ NEW: Helper function to calculate contact completion percentage
const calculateContactCompletion = (contact) => {
  const fields = [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.company,
    contact.jobTitle,
    contact.source !== "other" ? contact.source : null,
    contact.address?.street,
    contact.address?.city,
    contact.address?.state,
    contact.address?.country,
    contact.tags?.length > 0 ? true : null,
  ];

  const filledFields = fields.filter(
    (f) => f && f.toString().trim() !== "",
  ).length;
  const totalFields = fields.length;

  return Math.round((filledFields / totalFields) * 100);
};

// ✅ FIX: Helper function to get filter stats (improved)
const getFilterStats = async (baseQuery, userId) => {
  try {
    // Create a copy of baseQuery without pagination
    const statsQuery = { ...baseQuery };

    const [
      totalConnected,
      totalCompleted,
      totalDealValue,
      avgDealValue,
      statusBreakdown,
      totalRevenueAll, // ✅ NEW: Total revenue from all completed deals
    ] = await Promise.all([
      Contact.countDocuments({ ...statsQuery, connected: true }),
      Contact.countDocuments({ ...statsQuery, completed: true }),
      Contact.aggregate([
        { $match: { ...statsQuery, completed: true } },
        { $group: { _id: null, total: { $sum: "$dealValue" } } },
      ]),
      Contact.aggregate([
        { $match: { ...statsQuery, completed: true } },
        { $group: { _id: null, avg: { $avg: "$dealValue" } } },
      ]),
      Contact.aggregate([
        { $match: statsQuery },
        { $group: { _id: "$leadStatus", count: { $sum: 1 } } },
      ]),
      Contact.aggregate([
        // ✅ NEW: Total revenue regardless of filters
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            completed: true,
            isDeleted: false,
          },
        },
        { $group: { _id: null, total: { $sum: "$dealValue" } } },
      ]),
    ]);

    return {
      connected: totalConnected,
      completed: totalCompleted,
      totalRevenue: totalDealValue[0]?.total || 0,
      averageDealValue: avgDealValue[0]?.avg || 0,
      lifetimeRevenue: totalRevenueAll[0]?.total || 0, // ✅ NEW
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id || "unknown"] = item.count;
        return acc;
      }, {}),
    };
  } catch (error) {
    console.error("Error getting filter stats:", error);
    return {};
  }
};

// ===============================
// @desc    Get contact statistics with performance metrics
// @route   GET /api/contacts/stats/count
// @access  Private
// ===============================
const getContactStats = async (req, res) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // User's performance metrics
    const [
      total,
      recent,
      favorites,
      bySource,
      totalConnected,
      totalCompleted,
      totalRevenue,
      monthlyRevenue,
      leadStatusStats,
      conversionRate,
      recentCompleted,
      // ✅ NEW: Additional metrics
      yearlyRevenue,
      topPerformingSources,
      averageDealSize,
      deletedCount,
    ] = await Promise.all([
      // Total contacts
      Contact.countDocuments({ userId, isDeleted: false }),

      // Recent contacts (7 days)
      Contact.countDocuments({
        userId,
        createdAt: { $gte: oneWeekAgo },
        isDeleted: false,
      }),

      // Favorites
      Contact.countDocuments({ userId, isFavorite: true, isDeleted: false }),

      // By source
      Contact.aggregate([
        {
          $match: {
            userId,
            isDeleted: false,
            source: { $exists: true, $ne: null },
          },
        },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Total connected
      Contact.countDocuments({ userId, connected: true, isDeleted: false }),

      // Total completed
      Contact.countDocuments({ userId, completed: true, isDeleted: false }),

      // Total revenue stats
      Contact.aggregate([
        { $match: { userId, completed: true, isDeleted: false } },
        {
          $group: {
            _id: null,
            total: { $sum: "$dealValue" },
            avg: { $avg: "$dealValue" },
            max: { $max: "$dealValue" },
            min: { $min: "$dealValue" },
            count: { $sum: 1 },
          },
        },
      ]),

      // Monthly revenue (last 12 months) - ✅ IMPROVED
      Contact.aggregate([
        {
          $match: {
            userId,
            completed: true,
            completedAt: { $gte: oneYearAgo },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$completedAt" },
              month: { $month: "$completedAt" },
            },
            total: { $sum: "$dealValue" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 12 },
      ]),

      // Lead status breakdown
      Contact.aggregate([
        { $match: { userId, isDeleted: false } },
        { $group: { _id: "$leadStatus", count: { $sum: 1 } } },
      ]),

      // Conversion rate
      Contact.aggregate([
        { $match: { userId, isDeleted: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
            },
            connected: {
              $sum: { $cond: [{ $eq: ["$connected", true] }, 1, 0] },
            },
          },
        },
      ]),

      // Recent completed deals (last 10)
      Contact.find({ userId, completed: true, isDeleted: false })
        .sort({ completedAt: -1 })
        .limit(10)
        .select("firstName lastName company dealValue completedAt"),

      // ✅ NEW: Yearly revenue
      Contact.aggregate([
        {
          $match: {
            userId,
            completed: true,
            completedAt: { $gte: oneYearAgo },
            isDeleted: false,
          },
        },
        { $group: { _id: null, total: { $sum: "$dealValue" } } },
      ]),

      // ✅ NEW: Top performing sources by revenue
      Contact.aggregate([
        {
          $match: {
            userId,
            completed: true,
            isDeleted: false,
            source: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$source",
            count: { $sum: 1 },
            revenue: { $sum: "$dealValue" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),

      // ✅ NEW: Average deal size by status
      Contact.aggregate([
        { $match: { userId, isDeleted: false, dealValue: { $gt: 0 } } },
        {
          $group: {
            _id: "$leadStatus",
            avgDeal: { $avg: "$dealValue" },
            totalDeals: { $sum: 1 },
          },
        },
      ]),

      // ✅ NEW: Deleted contacts count (for admin)
      Contact.countDocuments({ userId, isDeleted: true }),
    ]);

    // Calculate conversion rates
    const totalLeads = conversionRate[0]?.total || 0;
    const totalCompletedLeads = conversionRate[0]?.completed || 0;
    const totalConnectedLeads = conversionRate[0]?.connected || 0;

    const conversionRateValue =
      totalLeads > 0
        ? ((totalCompletedLeads / totalLeads) * 100).toFixed(1)
        : 0;

    const connectionRate =
      totalLeads > 0
        ? ((totalConnectedLeads / totalLeads) * 100).toFixed(1)
        : 0;

    // Get recent month count
    const recentMonth = await Contact.countDocuments({
      userId,
      createdAt: { $gte: oneMonthAgo },
      isDeleted: false,
    });

    // Get average completion
    const avgCompletion = await getAverageCompletion(userId);

    // Format response
    res.status(200).json({
      success: true,
      data: {
        // Basic stats
        overview: {
          total,
          recentWeek: recent,
          recentMonth,
          favorites,
          deleted: deletedCount,
        },

        // Source breakdown
        bySource: bySource.map((s) => ({ source: s._id, count: s.count })),

        // Pipeline stats
        pipeline: {
          connected: totalConnected,
          completed: totalCompleted,
          conversionRate: conversionRateValue,
          connectionRate,
          leadStatus: leadStatusStats.reduce((acc, item) => {
            acc[item._id || "unknown"] = item.count;
            return acc;
          }, {}),
        },

        // Revenue stats
        revenue: {
          total: totalRevenue[0]?.total || 0,
          average: totalRevenue[0]?.avg || 0,
          max: totalRevenue[0]?.max || 0,
          min: totalRevenue[0]?.min || 0,
          dealCount: totalRevenue[0]?.count || 0,
          yearly: yearlyRevenue[0]?.total || 0,
        },

        // Monthly breakdown
        monthlyRevenue: monthlyRevenue.map((m) => ({
          month: `${m._id.year}-${String(m._id.month).padStart(2, "0")}`,
          total: m.total,
          count: m.count,
        })),

        // Top sources by revenue
        topSources: topPerformingSources.map((s) => ({
          source: s._id,
          count: s.count,
          revenue: s.revenue,
        })),

        // Average deal sizes
        averageDealSizes: averageDealSize.reduce((acc, item) => {
          acc[item._id || "unknown"] = {
            average: item.avgDeal,
            count: item.totalDeals,
          };
          return acc;
        }, {}),

        // Recent activity
        recentCompleted: recentCompleted.map((c) => ({
          id: c._id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          company: c.company,
          dealValue: c.dealValue,
          completedAt: c.completedAt,
        })),

        // Profile completion
        avgCompletion: parseFloat(avgCompletion),
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching statistics",
    });
  }
};

// Helper: Get average completion percentage
const getAverageCompletion = async (userId) => {
  const result = await Contact.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      },
    },
    {
      $project: {
        completionScore: {
          $add: [
            { $cond: [{ $ne: ["$firstName", ""] }, 1, 0] },
            { $cond: [{ $ne: ["$lastName", ""] }, 1, 0] },
            { $cond: [{ $ne: ["$email", ""] }, 1, 0] },
            { $cond: [{ $ne: ["$phone", ""] }, 1, 0] },
            { $cond: [{ $ne: ["$company", ""] }, 1, 0] },
            { $cond: [{ $ne: ["$jobTitle", ""] }, 1, 0] },
            {
              $cond: [
                {
                  $and: [
                    { $ne: ["$source", null] },
                    { $ne: ["$source", "other"] },
                  ],
                },
                1,
                0,
              ],
            },
            { $cond: [{ $ne: ["$address.city", ""] }, 1, 0] },
            {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$tags", []] } }, 0] },
                1,
                0,
              ],
            },
          ],
        },
        totalFields: { $literal: 9 },
      },
    },
    {
      $group: {
        _id: null,
        avgScore: { $avg: "$completionScore" },
        totalFields: { $first: "$totalFields" },
      },
    },
  ]);

  if (result.length > 0) {
    return ((result[0].avgScore / result[0].totalFields) * 100).toFixed(1);
  }
  return "0.0";
};

// ===============================
// @desc    Mark contact as connected
// @route   PATCH /api/contacts/:id/connected
// @access  Private
// ===============================
const markAsConnected = async (req, res) => {
  try {
    const { notes } = req.body;

    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Check if already completed
    if (contact.completed) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark completed deal as connected",
      });
    }

    // Check if already connected
    if (contact.connected) {
      return res.status(400).json({
        success: false,
        message: "Contact is already marked as connected",
      });
    }

    await contact.markAsConnected(req.user.id, notes);

    // ✅ FIX: Use new notification service
    setImmediate(async () => {
      try {
        await Notification.contact.notifyContactConnected(contact, req.user.id);
      } catch (err) {
        console.error("Connected notification error:", err);
      }
    });

    res.status(200).json({
      success: true,
      data: contact,
      message: "Contact marked as connected successfully",
    });
  } catch (error) {
    console.error("Mark as connected error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error marking contact as connected",
    });
  }
};

// ===============================
// @desc    Mark contact as completed with deal value
// @route   PATCH /api/contacts/:id/completed
// @access  Private
// ===============================
const markAsCompleted = async (req, res) => {
  try {
    const { dealValue, notes, currency = "INR" } = req.body;

    // Validate deal value
    if (!dealValue || dealValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid deal value is required for completed deals",
      });
    }

    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Check if already completed
    if (contact.completed) {
      return res.status(400).json({
        success: false,
        message: "Contact is already marked as completed",
      });
    }

    // Set currency
    contact.dealCurrency = currency;
    await contact.markAsCompleted(req.user.id, dealValue, notes);

    // ✅ FIX: Use new notification service
    setImmediate(async () => {
      try {
        // Send completion notification
        await Notification.contact.notifyContactCompleted(contact, req.user.id);

        // Check for big deal
        if (dealValue >= 100000) {
          // 1 lakh or more
          await Notification.contact.notifyBigDeal(contact, req.user.id);
        }

        // Check for milestones
        const userStats = await getUserMilestoneStats(req.user.id);
        await checkAndNotifyMilestones(req.user.id, userStats);
      } catch (err) {
        console.error("Completion notification error:", err);
      }
    });

    res.status(200).json({
      success: true,
      data: contact,
      message: `Deal completed successfully with value: ${dealValue} ${currency}`,
    });
  } catch (error) {
    console.error("Mark as completed error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error marking contact as completed",
    });
  }
};

// ✅ NEW: Helper to check user milestones
const getUserMilestoneStats = async (userId) => {
  const stats = await Contact.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        completed: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalDeals: { $sum: 1 },
        totalRevenue: { $sum: "$dealValue" },
        avgDealValue: { $avg: "$dealValue" },
      },
    },
  ]);

  return stats[0] || { totalDeals: 0, totalRevenue: 0, avgDealValue: 0 };
};

// ✅ NEW: Check and notify milestones
const checkAndNotifyMilestones = async (userId, stats) => {
  const { totalDeals, totalRevenue } = stats;

  // First deal
  if (totalDeals === 1) {
    await Notification.performance.notifyMilestone(userId, "first_deal", stats);
  }

  // 5 deals
  if (totalDeals === 5) {
    await Notification.performance.notifyMilestone(userId, "five_deals", stats);
  }

  // 10 deals
  if (totalDeals === 10) {
    await Notification.performance.notifyMilestone(userId, "ten_deals", stats);
  }

  // Revenue milestones
  if (totalRevenue >= 100000 && totalRevenue < 200000) {
    await Notification.performance.notifyMilestone(
      userId,
      "revenue_lakh",
      stats,
    );
  }

  if (totalRevenue >= 1000000) {
    await Notification.performance.notifyMilestone(
      userId,
      "revenue_crore",
      stats,
    );
  }
};

// ===============================
// @desc    Get user performance report
// @route   GET /api/contacts/performance
// @access  Private
// ===============================
const getUserPerformance = async (req, res) => {
  try {
    const { from, to, userId } = req.query;

    // Admin can see other users' performance
    const targetUserId = userId
      ? new mongoose.Types.ObjectId(userId)
      : new mongoose.Types.ObjectId(req.user.id);

    // Date range
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    // Set time boundaries
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 59, 999);

    const performance = await Contact.aggregate([
      {
        $match: {
          userId: targetUserId,
          isDeleted: false,
          $or: [
            { connectedAt: { $gte: dateFrom, $lte: dateTo } },
            { completedAt: { $gte: dateFrom, $lte: dateTo } },
          ],
        },
      },
      {
        $facet: {
          // Connected stats
          connected: [
            { $match: { connected: true } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                firstConnection: { $min: "$connectedAt" },
                lastConnection: { $max: "$connectedAt" },
              },
            },
          ],

          // Completed stats
          completed: [
            { $match: { completed: true } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalRevenue: { $sum: "$dealValue" },
                avgDealValue: { $avg: "$dealValue" },
                maxDealValue: { $max: "$dealValue" },
                minDealValue: { $min: "$dealValue" },
                firstDeal: { $min: "$completedAt" },
                lastDeal: { $max: "$completedAt" },
              },
            },
          ],

          // Daily breakdown
          daily: [
            {
              $group: {
                _id: {
                  date: {
                    $dateToString: { format: "%Y-%m-%d", date: "$completedAt" },
                  },
                },
                deals: {
                  $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
                },
                revenue: { $sum: "$dealValue" },
              },
            },
            { $sort: { "_id.date": -1 } },
            { $limit: 30 },
          ],

          // Source performance
          sourcePerformance: [
            { $match: { completed: true } },
            {
              $group: {
                _id: "$source",
                count: { $sum: 1 },
                revenue: { $sum: "$dealValue" },
              },
            },
            { $sort: { revenue: -1 } },
          ],
        },
      },
    ]);

    // Get user details
    const user = await User.findById(targetUserId).select(
      "name email role avatar department",
    );

    // Get overall stats (lifetime)
    const lifetimeStats = await Contact.aggregate([
      { $match: { userId: targetUserId, completed: true, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalDeals: { $sum: 1 },
          totalRevenue: { $sum: "$dealValue" },
          avgDealValue: { $avg: "$dealValue" },
        },
      },
    ]);

    const connected = performance[0]?.connected[0] || { count: 0 };
    const completed = performance[0]?.completed[0] || {
      count: 0,
      totalRevenue: 0,
      avgDealValue: 0,
      maxDealValue: 0,
      minDealValue: 0,
    };

    // Calculate conversion rate
    const conversionRate =
      connected.count > 0
        ? ((completed.count / connected.count) * 100).toFixed(1)
        : "0.0";

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user?._id,
          name: user?.name,
          email: user?.email,
          role: user?.role,
          avatar: user?.avatar,
          department: user?.department,
        },
        period: {
          from: dateFrom,
          to: dateTo,
        },
        performance: {
          connected: {
            count: connected.count,
            firstConnection: connected.firstConnection,
            lastConnection: connected.lastConnection,
          },
          completed: {
            count: completed.count,
            totalRevenue: completed.totalRevenue,
            avgDealValue: completed.avgDealValue,
            maxDealValue: completed.maxDealValue,
            minDealValue: completed.minDealValue,
            firstDeal: completed.firstDeal,
            lastDeal: completed.lastDeal,
          },
          lifetime: {
            totalDeals: lifetimeStats[0]?.totalDeals || 0,
            totalRevenue: lifetimeStats[0]?.totalRevenue || 0,
            avgDealValue: lifetimeStats[0]?.avgDealValue || 0,
          },
          conversionRate: parseFloat(conversionRate),
          daily: performance[0]?.daily || [],
          sourcePerformance: performance[0]?.sourcePerformance || [],
        },
      },
    });
  } catch (error) {
    console.error("Performance report error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating performance report",
    });
  }
};

// ===============================
// @desc    Update contact (with all fields)
// @route   PUT /api/contacts/:id
// @access  Private
// ===============================
const updateContact = async (req, res) => {
  try {
    // Find existing contact
    const existingContact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!existingContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Track status changes for notifications
    const oldStatus = {
      connected: existingContact.connected,
      completed: existingContact.completed,
      leadStatus: existingContact.leadStatus,
      dealValue: existingContact.dealValue,
    };

    // Allowed fields for update
    const allowedUpdates = [
      "firstName",
      "lastName",
      "company",
      "jobTitle",
      "email",
      "phone",
      "address",
      "tags",
      "notes",
      "lastContacted",
      "isFavorite",
      "source",
      "leadStatus",
      "connected",
      "completed",
      "dealValue",
      "dealCurrency",
      "connectedNotes",
      "completedNotes",
    ];

    // Filter only allowed fields
    const updates = {};
    const updateOperations = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (typeof req.body[key] === "string") {
          updates[key] = req.body[key].trim();
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    // Special handling for completed status
    if (
      updates.completed === true &&
      !updates.dealValue &&
      !existingContact.dealValue
    ) {
      return res.status(400).json({
        success: false,
        message: "Deal value is required when marking as completed",
      });
    }

    // Check for duplicate email
    if (updates.email && updates.email.trim()) {
      updates.email = updates.email.toLowerCase();

      const duplicateContact = await Contact.findOne({
        _id: { $ne: req.params.id },
        userId: req.user.id,
        email: updates.email,
        isDeleted: false,
      });

      if (duplicateContact) {
        return res.status(400).json({
          success: false,
          message: "Another contact with this email already exists",
        });
      }
    }

    // Update timestamps and history for status changes
    if (updates.connected === true && !existingContact.connected) {
      updates.connectedAt = new Date();

      if (!updateOperations.$push) updateOperations.$push = {};
      updateOperations.$push.statusHistory = {
        status: "connected",
        changedAt: new Date(),
        changedBy: req.user.id,
        notes: updates.connectedNotes || "Marked as connected",
      };
    }

    if (updates.completed === true && !existingContact.completed) {
      updates.completedAt = new Date();
      updates.dealClosedDate = new Date();

      if (!updateOperations.$push) updateOperations.$push = {};
      updateOperations.$push.statusHistory = {
        status: "completed",
        changedAt: new Date(),
        changedBy: req.user.id,
        notes: `${updates.completedNotes || "Deal completed"} | Value: ${updates.dealValue || existingContact.dealValue}`,
      };
    }

    // Add lastModified
    updates.lastModified = Date.now();

    // Combine updates
    const finalUpdate = { ...updates, ...updateOperations };

    // Update contact
    const contact = await Contact.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        isDeleted: false,
      },
      finalUpdate,
      {
        new: true,
        runValidators: true,
      },
    ).select("-__v");

    // Send notifications for status changes
    setImmediate(async () => {
      try {
        // If newly connected
        if (updates.connected === true && !oldStatus.connected) {
          await Notification.contact.notifyContactConnected(
            contact,
            req.user.id,
          );
        }

        // If newly completed
        if (updates.completed === true && !oldStatus.completed) {
          await Notification.contact.notifyContactCompleted(
            contact,
            req.user.id,
          );

          // Check for big deal
          if (contact.dealValue >= 100000) {
            await Notification.contact.notifyBigDeal(contact, req.user.id);
          }
        }

        // If lead status changed
        if (updates.leadStatus && updates.leadStatus !== oldStatus.leadStatus) {
          await Notification.contact.notifyLeadStatusChanged(
            contact,
            oldStatus.leadStatus,
            updates.leadStatus,
            req.user.id,
          );
        }
      } catch (err) {
        console.error("Update notification error:", err);
      }
    });

    res.status(200).json({
      success: true,
      data: contact,
      message: "Contact updated successfully",
    });
  } catch (error) {
    console.error("Update contact error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating contact",
    });
  }
};

// ===============================
// @desc    Create new contact (with all fields)
// @route   POST /api/contacts
// @access  Private
// ===============================
const createContact = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      tags,
      notes,
      address,
      source,
      lastContacted,
      isFavorite,
      leadStatus,
      connected,
      completed,
      dealValue,
      dealCurrency,
      connectedNotes,
      completedNotes,
    } = req.body;

    // Required field check
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required",
      });
    }

    // Validate firstName length
    if (firstName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "First name must be at least 2 characters",
      });
    }

    // Validate deal value if completed
    if (completed && (!dealValue || dealValue <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Deal value is required for completed contacts",
      });
    }

    // Validate email if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please include a valid email",
        });
      }
    }

    // Check duplicate email
    if (email && email.trim()) {
      const exists = await Contact.findOne({
        userId: req.user.id,
        email: email.toLowerCase(),
        isDeleted: false,
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Contact with this email already exists",
        });
      }
    }

    // Prepare contact data
    const contactData = {
      userId: req.user.id,
      firstName: firstName.trim(),
      lastName: (lastName || "").trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: (phone || "").trim(),
      company: (company || "").trim(),
      jobTitle: (jobTitle || "").trim(),
      notes: (notes || "").trim(),
      source: source || "other",
      lastContacted: lastContacted || null,
      isFavorite: isFavorite || false,
      leadStatus: leadStatus || "cold",
      connected: connected || false,
      completed: completed || false,
      dealValue: completed ? dealValue : 0,
      dealCurrency: dealCurrency || "INR",
      connectedNotes: connectedNotes || "",
      completedNotes: completedNotes || "",
    };

    // Set timestamps based on status
    if (contactData.connected) {
      contactData.connectedAt = new Date();
    }

    if (contactData.completed) {
      contactData.completedAt = new Date();
      contactData.dealClosedDate = new Date();
    }

    // Process tags
    if (tags) {
      if (Array.isArray(tags)) {
        contactData.tags = tags
          .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag)))
          .filter((tag) => tag);
      } else if (typeof tags === "string") {
        contactData.tags = tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t);
      }
    }

    // Process address
    if (address && typeof address === "object") {
      contactData.address = {};
      if (address.street) contactData.address.street = address.street.trim();
      if (address.city) contactData.address.city = address.city.trim();
      if (address.state) contactData.address.state = address.state.trim();
      if (address.country) contactData.address.country = address.country.trim();
      if (address.zipCode) contactData.address.zipCode = address.zipCode.trim();

      if (Object.keys(contactData.address).length === 0) {
        delete contactData.address;
      }
    }

    // Initialize status history
    contactData.statusHistory = [
      {
        status: contactData.leadStatus,
        changedAt: new Date(),
        changedBy: req.user.id,
        notes: "Contact created",
      },
    ];

    const contact = await Contact.create(contactData);

    // Send notifications
    setImmediate(async () => {
      try {
        await Notification.contact.notifyContactCreated(contact, req.user.id);

        if (contact.leadStatus === "hot") {
          // Additional notification for hot leads
          await Notification.contact.notifyLeadStatusChanged(
            contact,
            "cold",
            "hot",
            req.user.id,
          );
        }
      } catch (err) {
        console.error("Create notification error:", err);
      }
    });

    const contactResponse = contact.toObject();
    delete contactResponse.__v;

    // Add completion percentage
    contactResponse.completionPercentage = calculateContactCompletion(contact);

    res.status(201).json({
      success: true,
      data: contactResponse,
      message: "Contact created successfully",
    });
  } catch (error) {
    console.error("Create contact error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists for another contact",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating contact",
    });
  }
};

// ===============================
// @desc    Get tag statistics
// @route   GET /api/contacts/stats/tags
// @access  Private
// ===============================
const getTagStats = async (req, res) => {
  try {
    const tagStats = await Contact.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          isDeleted: false,
          tags: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ["$connected", true] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] } },
          revenue: {
            $sum: { $cond: [{ $eq: ["$completed", true] }, "$dealValue", 0] },
          },
          avgDealValue: {
            $avg: {
              $cond: [{ $eq: ["$completed", true] }, "$dealValue", null],
            },
          },
        },
      },
      {
        $project: {
          tag: "$_id",
          count: 1,
          connected: 1,
          completed: 1,
          revenue: 1,
          avgDealValue: { $ifNull: ["$avgDealValue", 0] },
          conversionRate: {
            $cond: {
              if: { $gt: ["$count", 0] },
              then: { $multiply: [{ $divide: ["$completed", "$count"] }, 100] },
              else: 0,
            },
          },
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]);

    res.status(200).json({
      success: true,
      data: tagStats,
    });
  } catch (error) {
    console.error("Get tag stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching tag statistics",
    });
  }
};

// ===============================
// @desc    Batch sync contacts (with improved handling)
// @route   POST /api/contacts/batch
// @access  Private
// ===============================
const batchSyncContacts = async (req, res) => {
  try {
    const { contacts = [], options = {} } = req.body;
    const { overwriteExisting = false, skipDuplicates = false } = options;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        message: "Contacts must be an array",
      });
    }

    if (contacts.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Cannot process more than 500 contacts at once",
      });
    }

    const results = {
      created: [],
      updated: [],
      skipped: [],
      errors: [],
    };

    // Process contacts in batches of 50 for better performance
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (contactData) => {
          try {
            // Validate required fields
            if (!contactData.firstName || !contactData.firstName.trim()) {
              throw new Error("First name is required");
            }

            // Normalize email
            let email = contactData.email
              ? contactData.email.toLowerCase().trim()
              : null;

            // Check for existing contact by email
            let existingContact = null;
            if (email) {
              existingContact = await Contact.findOne({
                userId: req.user.id,
                email: email,
                isDeleted: false,
              });
            }

            // Handle based on options
            if (existingContact) {
              if (skipDuplicates) {
                results.skipped.push({
                  id: existingContact._id,
                  email: email,
                  reason: "Duplicate contact",
                });
                return;
              }

              if (overwriteExisting) {
                // Update existing contact
                const updates = { ...contactData, lastModified: Date.now() };
                delete updates._id;

                const updated = await Contact.findByIdAndUpdate(
                  existingContact._id,
                  updates,
                  { new: true, runValidators: true },
                );

                results.updated.push({
                  id: updated._id,
                  email: email,
                });
              } else {
                results.skipped.push({
                  id: existingContact._id,
                  email: email,
                  reason: "Contact exists",
                });
              }
            } else {
              // Create new contact
              const newContact = new Contact({
                ...contactData,
                userId: req.user.id,
                email: email,
              });

              await newContact.save();
              results.created.push({
                id: newContact._id,
                email: email,
              });

              // Send notification for new contact
              setImmediate(() => {
                Notification.contact
                  .notifyContactCreated(newContact, req.user.id)
                  .catch(() => {});
              });
            }
          } catch (error) {
            results.errors.push({
              contact: contactData.email || contactData.firstName || "Unknown",
              error: error.message,
            });
          }
        }),
      );
    }

    res.status(200).json({
      success: true,
      data: results,
      summary: {
        totalProcessed: contacts.length,
        created: results.created.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        failed: results.errors.length,
      },
      message: `Batch processed: ${results.created.length} created, ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.errors.length} failed`,
    });
  } catch (error) {
    console.error("Batch processing error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing batch contacts",
    });
  }
};

// ===============================
// @desc    Get single contact by ID
// @route   GET /api/contacts/:id
// @access  Private
// ===============================
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    }).select("-__v");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Add completion percentage
    const contactWithCompletion = {
      ...contact.toObject(),
      completionPercentage: calculateContactCompletion(contact)
    };

    res.status(200).json({
      success: true,
      data: contactWithCompletion,
    });
  } catch (error) {
    console.error("Get contact by ID error:", error);

    // Check for invalid ID format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while fetching contact",
    });
  }
};

// ===============================
// @desc    Toggle favorite status
// @route   PATCH /api/contacts/:id/favorite
// @access  Private
// ===============================
const toggleFavorite = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Toggle favorite status
    contact.isFavorite = !contact.isFavorite;
    contact.lastModified = Date.now();
    await contact.save();

    res.status(200).json({
      success: true,
      data: contact,
      message: `Contact ${contact.isFavorite ? "added to" : "removed from"} favorites`,
    });
  } catch (error) {
    console.error("Toggle favorite error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating favorite status",
    });
  }
};


// ===============================
// @desc    Soft delete contact
// @route   DELETE /api/contacts/:id
// @access  Private
// ===============================
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
        lastModified: Date.now(),
      },
      {
        new: true,
      }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
      data: { id: contact._id },
    });
  } catch (error) {
    console.error("Delete contact error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while deleting contact",
    });
  }
};

// Export all functions
module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  toggleFavorite,
  deleteContact,
  getContactStats,
  getTagStats,
  batchSyncContacts,
  markAsConnected,
  markAsCompleted,
  getUserPerformance,
};
