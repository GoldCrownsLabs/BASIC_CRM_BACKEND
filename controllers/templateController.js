const Template = require("../models/Template");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { sendBulkEmails } = require("../utils/emailService");

/**
 * @desc    Create new template
 * @route   POST /api/templates
 * @access  Private
 */
const createTemplate = async (req, res) => {
  try {
    const { name, type, subject, content, variables, customVariables } =
      req.body;

    // Validation
    if (!name || !type || !content) {
      return res.status(400).json({
        success: false,
        message: "Name, type and content are required",
      });
    }

    // For email templates, subject is required
    if ((type === "email" || type === "both") && !subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required for email templates",
      });
    }

    const template = await Template.create({
      name,
      type,
      subject,
      content,
      variables: variables || [],
      customVariables: customVariables || [],
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Create template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create template",
      error: error.message,
    });
  }
};

/**
 * @desc    Get all templates
 * @route   GET /api/templates
 * @access  Private
 */
const getTemplates = async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;

    const templates = await Template.find(filter)
      .populate("createdBy", "name email companyEmail")
      .sort("-createdAt");

    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch templates",
    });
  }
};

/**
 * @desc    Get single template
 * @route   GET /api/templates/:id
 * @access  Private
 */
const getTemplateById = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id).populate(
      "createdBy",
      "name email companyEmail",
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch template",
    });
  }
};

/**
 * @desc    Update template
 * @route   PUT /api/templates/:id
 * @access  Private
 */
const updateTemplate = async (req, res) => {
  try {
    let template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Check if user is creator or admin
    if (
      template.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this template",
      });
    }

    template = await Template.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Update template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update template",
    });
  }
};

/**
 * @desc    Delete template
 * @route   DELETE /api/templates/:id
 * @access  Private (Admin only)
 */
const deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    await template.deleteOne();

    res.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Delete template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete template",
    });
  }
};

/**
 * @desc    Send template to leads (BREVO REAL EMAILS ONLY)
 * @route   POST /api/templates/:id/send
 * @access  Private
 */
const sendTemplateToLeads = async (req, res) => {
  try {
    const { leadIds, channel } = req.body;

    // Check if template exists
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Validate leads
    if (!leadIds || !leadIds.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one lead",
      });
    }

    // Fetch leads from database
    const leads = await Lead.find({
      _id: { $in: leadIds },
    });

    if (!leads.length) {
      return res.status(404).json({
        success: false,
        message: "No leads found with the provided IDs",
      });
    }

    // Initialize results object
    const results = {
      total: leads.length,
      sent: 0,
      failed: 0,
      emailResults: {
        successful: [],
        failed: [],
      },
      whatsappResults: {
        successful: [],
        failed: [],
      },
    };

    // Determine which channel to use
    const sendChannel = channel || template.type;

    // Handle EMAIL sending
    if (sendChannel === "email" || sendChannel === "both") {
      // Filter leads with email
      const leadsWithEmail = leads.filter(
        (lead) => lead.email && lead.email.includes("@"),
      );

      console.log(`📧 Found ${leadsWithEmail.length} leads with valid email`);

      if (leadsWithEmail.length === 0) {
        results.emailResults.message = "No valid leads with email found";
      } else {
        // Prepare recipients for bulk email
        const recipients = leadsWithEmail.map((lead) => ({
          email: lead.email.trim(),
          name: lead.name || lead.firstName || "Valued Customer",
          variables: {
            name: lead.name || lead.firstName || "Valued Customer",
            email: lead.email,
            phone: lead.phone || "Not provided",
            company: lead.company || "Your Company",
            position: lead.position || "Team Member",
            date: new Date().toLocaleDateString("en-IN"),
          },
        }));

        console.log("📨 Recipients prepared:", recipients);

        try {
          // ✅ Send emails via Brevo
          const emailResults = await sendBulkEmails(
            recipients,
            template.subject,
            template.content,
            {
              from:
                process.env.BREVO_FROM ||
                '"Avinash" <avinash@goldcrownlabs.com>',
            },
          );

          console.log("📊 Email results:", emailResults);

          // Update results
          if (emailResults && emailResults.successful) {
            results.emailResults.successful = emailResults.successful.map(
              (s) => ({
                email: s.email,
                name: s.name,
                messageId: s.messageId,
              }),
            );

            results.sent = emailResults.successful.length;
          }

          if (emailResults && emailResults.failed) {
            results.emailResults.failed = emailResults.failed;
            results.failed = emailResults.failed.length;
          }
        } catch (emailError) {
          console.error("❌ Bulk email error:", emailError);
          results.emailResults.error = emailError.message;
        }
      }
    }

    // Handle WHATSAPP sending (Coming soon)
    if (sendChannel === "whatsapp" || sendChannel === "both") {
      results.whatsappResults.message =
        "WhatsApp integration coming soon! Currently in development.";
    }

    // Prepare final response
    const response = {
      success: true,
      message: `✅ ${results.sent} real ${results.sent === 1 ? "email" : "emails"} sent successfully via Brevo! ${results.failed} failed.`,
      summary: {
        totalLeads: results.total,
        successfullySent: results.sent,
        failed: results.failed,
        channels: sendChannel,
        provider: "Brevo (Real Emails)",
        dailyLimit: "300 emails/day free",
        remainingToday: `${300 - results.sent} emails remaining`,
      },
      details: {
        sent: results.emailResults.successful,
        failed: results.emailResults.failed.map((f) => ({
          email: f.email,
          name: f.name,
          error: f.error,
        })),
      },
    };

    // Add warning if some emails failed
    if (results.failed > 0) {
      response.warning =
        "⚠️ Some emails failed to send. Check 'details.failed' for more information.";
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Send template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send template",
      error: error.message,
    });
  }
};

/**
 * @desc    Preview template with sample data
 * @route   POST /api/templates/preview
 * @access  Private
 */
const previewTemplate = async (req, res) => {
  try {
    const { content, subject, variables } = req.body;

    const previewData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+91 98765 43210",
      company: "ABC Corp Ltd.",
      position: "Senior Manager",
      date: new Date().toLocaleDateString("en-IN"),
      ...variables,
    };

    const preview = {
      subject: subject ? replaceVariables(subject, previewData) : null,
      content: replaceVariables(content, previewData),
      usedVariables: previewData,
      note: "This is a preview with sample data. Actual emails will use real lead data.",
    };

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error("Preview template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to preview template",
      error: error.message,
    });
  }
};

/**
 * @desc    Test Brevo email configuration
 * @route   GET /api/templates/test-email
 * @access  Private
 */
const testEmailConfig = async (req, res) => {
  try {
    const { sendTestEmail } = require("../utils/emailService");
    const testResult = await sendTestEmail();

    if (testResult && testResult.success) {
      res.json({
        success: true,
        message: "✅ Test email sent successfully via Brevo!",
        data: {
          messageId: testResult.messageId,
          provider: "Brevo",
          to: testResult.to,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send test email",
        error: testResult?.error || "Unknown error",
      });
    }
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message,
    });
  }
};

/**
 * @desc    Get template variables help
 * @route   GET /api/templates/variables-help
 * @access  Private
 */
const getVariablesHelp = async (req, res) => {
  const help = {
    availableVariables: [
      {
        name: "name",
        description: "Lead's full name",
        example: "Rahul Sharma",
      },
      {
        name: "email",
        description: "Lead's email address",
        example: "rahul@example.com",
      },
      {
        name: "phone",
        description: "Lead's phone number",
        example: "+91 98765 43210",
      },
      {
        name: "company",
        description: "Lead's company name",
        example: "Tech Solutions",
      },
      {
        name: "position",
        description: "Lead's job position",
        example: "Software Developer",
      },
      {
        name: "date",
        description: "Current date",
        example: "23/02/2026",
      },
    ],
    howToUse:
      "Use curly braces to insert variables: Dear {name}, Welcome to {company}!",
    examples: [
      { template: "Dear {name},", result: "Dear Rahul Sharma," },
      {
        template: "Your email {email} is registered",
        result: "Your email rahul@example.com is registered",
      },
      {
        template: "Company: {company}, Position: {position}",
        result: "Company: Tech Solutions, Position: Software Developer",
      },
    ],
    note: "Variables are automatically replaced with lead data when sending real emails via Brevo.",
    provider: "Brevo (300 emails/day free)",
  };

  res.json({
    success: true,
    data: help,
  });
};

/**
 * @desc    Get Brevo usage statistics
 * @route   GET /api/templates/usage
 * @access  Private (Admin only)
 */
const getBrevoUsage = async (req, res) => {
  try {
    // This would ideally call Brevo API to get actual usage
    // For now, returning static info
    res.json({
      success: true,
      data: {
        provider: "Brevo",
        plan: "Free",
        dailyLimit: 300,
        monthlyLimit: 9000,
        features: [
          "Real email delivery",
          "Open tracking",
          "Click tracking",
          "Spam check",
          "DKIM/SPF support",
        ],
        setup: {
          smtpHost: "smtp-relay.brevo.com",
          smtpPort: 587,
          fromEmail: "a31b67001@smtp-brevo.com",
        },
      },
    });
  } catch (error) {
    console.error("Usage error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get usage info",
      error: error.message,
    });
  }
};

// Helper function to replace variables in template
const replaceVariables = (text, variables) => {
  if (!text) return text;

  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey];

    if (value === undefined || value === null) {
      console.warn(`⚠️ Variable "${trimmedKey}" not found in data`);
      return match;
    }

    return value;
  });
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  sendTemplateToLeads,
  previewTemplate,
  testEmailConfig,
  getVariablesHelp,
  getBrevoUsage,
};
