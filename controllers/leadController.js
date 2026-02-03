const Lead = require("../models/Lead");

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private
exports.createLead = async (req, res) => {
  try {
    console.log("=== CREATE LEAD DEBUG ===");
    console.log("1. Request Body:", JSON.stringify(req.body, null, 2));
    console.log("2. User from Auth:", req.user);
    console.log("3. User ID:", req.user ? req.user.id : null);
    console.log("========================");

    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      source,
      status,
      budget,
      priority,
      assignedTo,
      nextFollowUp,
      customFields,
    } = req.body;

    // Validation
    if (!firstName || !email) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        error: "First name and email are required",
      });
    }

    // Check if user exists
    if (!req.user || !req.user.id) {
      console.log("❌ No user in request");
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    console.log("🔍 Checking for existing lead with email:", email);
    const existingLead = await Lead.findOne({ email });

    if (existingLead) {
      console.log("❌ Lead already exists with email:", email);
      return res.status(400).json({
        success: false,
        error: "Lead with this email already exists",
      });
    }

    console.log("🔍 Creating new lead...");
    const lead = new Lead({
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      source: source || "website",
      status: status || "new",
      budget,
      priority: priority || "medium",
      assignedTo,
      nextFollowUp,
      customFields,
      createdBy: req.user.id,
    });

    console.log("🔍 Saving lead to database...");
    await lead.save();
    console.log("✅ Lead saved successfully:", lead._id);

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    console.error("❌❌❌ CREATE LEAD ERROR DETAILS ❌❌❌");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);

    // Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      console.error("Validation Errors:", errors);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    // Duplicate key error
    if (error.code === 11000) {
      console.error("Duplicate key error:", error.keyValue);
      return res.status(400).json({
        success: false,
        error: "Duplicate entry found",
        field: Object.keys(error.keyValue)[0],
      });
    }

    console.error("❌❌❌ END ERROR ❌❌❌");

    res.status(500).json({
      success: false,
      error: "Failed to create lead",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get all leads with pagination, filtering, and sorting
// @route   GET /api/leads
// @access  Private
exports.getLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      source,
      priority,
      assignedTo,
      search,
      startDate,
      endDate,
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { jobTitle: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination info
    const total = await Lead.countDocuments(filter);

    // Fetch leads with pagination and sorting
    const leads = await Lead.find(filter)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({
        [sortBy]: sortOrder === "desc" ? -1 : 1,
      })
      .skip(skip)
      .limit(parseInt(limit));

    // Get statistics
    const stats = await Lead.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get distinct values for filters
    const statusValues = await Lead.distinct("status");
    const sourceValues = await Lead.distinct("source");
    const priorityValues = await Lead.distinct("priority");

    // Convert stats array to object
    const statsObj = {};
    stats.forEach((item) => {
      statsObj[item._id] = item.count;
    });

    res.json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      stats: statsObj,
      filters: {
        status: [...new Set(statusValues)],
        source: [...new Set(sourceValues)],
        priority: [...new Set(priorityValues)],
      },
    });
  } catch (error) {
    console.error("Get leads error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leads",
    });
  }
};

// @desc    Get single lead by ID
// @route   GET /api/leads/:id
// @access  Private
exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "name email avatar")
      .populate("createdBy", "name email")
      .populate("notes.createdBy", "name email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Get lead by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch lead",
    });
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private
exports.updateLead = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      source,
      status,
      budget,
      priority,
      assignedTo,
      nextFollowUp,
      customFields,
    } = req.body;

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    // Check if email is being changed and if new email already exists
    if (email && email !== lead.email) {
      const existingLead = await Lead.findOne({ email });
      if (existingLead && existingLead._id.toString() !== req.params.id) {
        return res.status(400).json({
          success: false,
          error: "Another lead with this email already exists",
        });
      }
    }

    // Update fields
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;
    if (company !== undefined) updateFields.company = company;
    if (jobTitle !== undefined) updateFields.jobTitle = jobTitle;
    if (source !== undefined) updateFields.source = source;
    if (status !== undefined) updateFields.status = status;
    if (budget !== undefined) updateFields.budget = budget;
    if (priority !== undefined) updateFields.priority = priority;
    if (assignedTo !== undefined) updateFields.assignedTo = assignedTo;
    if (nextFollowUp !== undefined) updateFields.nextFollowUp = nextFollowUp;
    if (customFields !== undefined) updateFields.customFields = customFields;

    // Update the lead
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true },
    ).populate("assignedTo", "name email");

    res.json({
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update lead",
    });
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    await lead.deleteOne();

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete lead",
    });
  }
};

// @desc    Add note to lead
// @route   POST /api/leads/:id/notes
// @access  Private
exports.addNote = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Note content is required",
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    await lead.addNote(content.trim(), req.user.id);

    const updatedLead = await Lead.findById(req.params.id).populate(
      "notes.createdBy",
      "name email",
    );

    res.json({
      success: true,
      message: "Note added successfully",
      data: updatedLead.notes,
    });
  } catch (error) {
    console.error("Add note error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add note",
    });
  }
};

// @desc    Update lead status
// @route   PATCH /api/leads/:id/status
// @access  Private
exports.updateLeadStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    await lead.updateStatus(status, note, req.user.id);

    const updatedLead = await Lead.findById(req.params.id);

    res.json({
      success: true,
      message: "Lead status updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update lead status",
    });
  }
};

// @desc    Get leads assigned to current user
// @route   GET /api/leads/assigned/me
// @access  Private
exports.getMyLeads = async (req, res) => {
  try {
    const leads = await Lead.find({ assignedTo: req.user.id })
      .populate("createdBy", "name email")
      .sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      data: leads,
    });
  } catch (error) {
    console.error("Get my leads error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch your leads",
    });
  }
};

// @desc    Get leads summary and statistics
// @route   GET /api/leads/summary/stats
// @access  Private
exports.getLeadStats = async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $facet: {
          totalLeads: [{ $count: "count" }],
          leadsByStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          leadsBySource: [{ $group: { _id: "$source", count: { $sum: 1 } } }],
          leadsByPriority: [
            { $group: { _id: "$priority", count: { $sum: 1 } } },
          ],
          leadsByMonth: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } },
            { $limit: 6 },
          ],
          hotLeads: [
            {
              $match: {
                priority: "high",
                status: { $in: ["new", "contacted", "qualified"] },
              },
            },
            { $count: "count" },
          ],
          conversionRate: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                converted: {
                  $sum: { $cond: [{ $eq: ["$status", "closed_won"] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]);

    // Safely process the results
    const result = {
      totalLeads:
        stats && stats[0] && stats[0].totalLeads && stats[0].totalLeads[0]
          ? stats[0].totalLeads[0].count
          : 0,
      leadsByStatus:
        stats && stats[0] && stats[0].leadsByStatus
          ? stats[0].leadsByStatus
          : [],
      leadsBySource:
        stats && stats[0] && stats[0].leadsBySource
          ? stats[0].leadsBySource
          : [],
      leadsByPriority:
        stats && stats[0] && stats[0].leadsByPriority
          ? stats[0].leadsByPriority
          : [],
      leadsByMonth:
        stats && stats[0] && stats[0].leadsByMonth
          ? stats[0].leadsByMonth.map((item) => ({
              month: `${item._id.year}-${item._id.month.toString().padStart(2, "0")}`,
              count: item.count,
            }))
          : [],
      hotLeads:
        stats && stats[0] && stats[0].hotLeads && stats[0].hotLeads[0]
          ? stats[0].hotLeads[0].count
          : 0,
      conversionRate:
        stats &&
        stats[0] &&
        stats[0].conversionRate &&
        stats[0].conversionRate[0]
          ? (
              (stats[0].conversionRate[0].converted /
                stats[0].conversionRate[0].total) *
              100
            ).toFixed(2)
          : "0.00",
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get lead stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch lead statistics",
    });
  }
};

// @desc    Bulk update leads (status, assignedTo, etc.)
// @route   PUT /api/leads/bulk-update
// @access  Private
exports.bulkUpdateLeads = async (req, res) => {
  try {
    const { leadIds, updateFields } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Lead IDs are required",
      });
    }

    if (!updateFields || Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Update fields are required",
      });
    }

    const allowedFields = ["status", "assignedTo", "priority", "source"];
    const filteredUpdateFields = {};

    Object.keys(updateFields).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdateFields[key] = updateFields[key];
      }
    });

    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      { $set: filteredUpdateFields },
    );

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} leads`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to bulk update leads",
    });
  }
};
