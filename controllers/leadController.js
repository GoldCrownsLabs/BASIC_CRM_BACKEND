// controllers/leadController.js

const Lead = require("../models/Lead");
const User = require("../models/User");
const Notification = require("../services/notifications");
const mongoose = require("mongoose");

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private
exports.createLead = async (req, res) => {
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

    // Validation
    if (!firstName || !email) {
      return res.status(400).json({
        success: false,
        error: "First name and email are required",
      });
    }

    // Check if user exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    // Check for existing lead (only among user's leads)
    const existingLead = await Lead.findOne({
      email,
      createdBy: req.user.id,
    });

    if (existingLead) {
      return res.status(400).json({
        success: false,
        error: "Lead with this email already exists",
      });
    }

    // Create lead
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

    await lead.save();

    // ✅ Send notification using lead module
    setImmediate(() => {
      Notification.lead
        .notifyLeadCreated(lead, req.user.id)
        .then(() => {
          console.log(`📨 Lead notification sent: ${lead._id}`);
        })
        .catch((err) => {
          console.error("Lead notification error:", err);
        });
    });

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Create lead error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Duplicate entry found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create lead",
    });
  }
};

// @desc    Get all leads with pagination
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

    // Always filter by current user
    const filter = {
      createdBy: req.user.id,
    };

    // Add optional filters
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Lead.countDocuments(filter);

    const leads = await Lead.find(filter)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get stats for filters (only for user's leads)
    const statusValues = await Lead.distinct("status", {
      createdBy: req.user.id,
    });
    const sourceValues = await Lead.distinct("source", {
      createdBy: req.user.id,
    });
    const priorityValues = await Lead.distinct("priority", {
      createdBy: req.user.id,
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
      filters: {
        status: statusValues,
        source: sourceValues,
        priority: priorityValues,
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
    // Check ownership
    const lead = await Lead.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    })
      .populate("assignedTo", "name email")
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

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        error: "Invalid lead ID format",
      });
    }

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
    // Check ownership
    const lead = await Lead.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or you don't have permission",
      });
    }

    // Store old values for notification
    const oldStatus = lead.status;
    const oldAssignedTo = lead.assignedTo;

    // Check email uniqueness if being updated (only among user's leads)
    if (req.body.email && req.body.email !== lead.email) {
      const existingLead = await Lead.findOne({
        email: req.body.email,
        createdBy: req.user.id,
        _id: { $ne: req.params.id },
      });
      if (existingLead) {
        return res.status(400).json({
          success: false,
          error: "Email already in use by another lead",
        });
      }
    }

    // Update lead
    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("assignedTo", "name email");

    // ✅ Send notifications using lead module
    setImmediate(() => {
      // Status change notification
      if (req.body.status && oldStatus !== req.body.status) {
        Notification.lead
          .notifyLeadStatusChanged(
            updatedLead,
            oldStatus,
            req.body.status,
            req.user.id,
          )
          .catch((err) => console.error("Status notification error:", err));
      }

      // Assignment change notification
      if (
        req.body.assignedTo &&
        oldAssignedTo?.toString() !== req.body.assignedTo.toString()
      ) {
        Notification.lead
          .notifyLeadAssigned(updatedLead, req.user.id)
          .catch((err) => console.error("Assignment notification error:", err));
      }
    });

    res.json({
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Update lead error:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        error: "Invalid lead ID format",
      });
    }

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
    // Check ownership and delete in one go
    const lead = await Lead.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or you don't have permission",
      });
    }

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        error: "Invalid lead ID format",
      });
    }

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

    // Check ownership
    const lead = await Lead.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or you don't have permission",
      });
    }

    // Add note
    lead.notes.push({
      content: content.trim(),
      createdBy: req.user.id,
      createdAt: new Date(),
    });

    await lead.save();

    // ✅ Send note notification using system module
    if (lead.assignedTo && lead.assignedTo.toString() !== req.user.id) {
      setImmediate(() => {
        Notification.system
          .sendToUser(
            lead.assignedTo,
            "📝 New Note Added",
            `A new note has been added to lead: ${lead.firstName} ${lead.lastName}`,
            {
              leadId: lead._id,
              noteContent:
                content.substring(0, 50) + (content.length > 50 ? "..." : ""),
            },
          )
          .catch((err) => console.error("Note notification error:", err));
      });
    }

    // Populate the new note for response
    await lead.populate("notes.createdBy", "name email");

    res.json({
      success: true,
      message: "Note added successfully",
      data: lead.notes,
    });
  } catch (error) {
    console.error("Add note error:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        error: "Invalid lead ID format",
      });
    }

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
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    // Check ownership
    const lead = await Lead.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found or you don't have permission",
      });
    }

    const oldStatus = lead.status;
    lead.status = status;
    await lead.save();

    // ✅ Send status change notification using lead module
    setImmediate(() => {
      Notification.lead
        .notifyLeadStatusChanged(lead, oldStatus, status, req.user.id)
        .catch((err) => console.error("Status notification error:", err));
    });


    
    res.json({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Update status error:", error);

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        error: "Invalid lead ID format",
      });
    }

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

// @desc    Get lead statistics
// @route   GET /api/leads/summary/stats
// @access  Private
exports.getLeadStats = async (req, res) => {
  try {
    // Only count user's leads
    const stats = await Lead.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(req.user.id),
        },
      },
      {
        $facet: {
          totalLeads: [{ $count: "count" }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          bySource: [{ $group: { _id: "$source", count: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
        },
      },
    ]);

    const result = {
      totalLeads: stats[0]?.totalLeads[0]?.count || 0,
      byStatus: stats[0]?.byStatus || [],
      bySource: stats[0]?.bySource || [],
      byPriority: stats[0]?.byPriority || [],
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

// @desc    Bulk update leads
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

    // Allowed fields for bulk update
    const allowedFields = ["status", "assignedTo", "priority", "source"];
    const filteredUpdate = {};

    Object.keys(updateFields).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdate[key] = updateFields[key];
      }
    });

    if (Object.keys(filteredUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid fields to update",
      });
    }



    // Only update user's own leads
    const result = await Lead.updateMany(
      {
        _id: { $in: leadIds },
        createdBy: req.user.id,
      },
      { $set: filteredUpdate },
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} leads successfully`,
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
