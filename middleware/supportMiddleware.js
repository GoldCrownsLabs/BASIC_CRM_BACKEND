// middleware/supportMiddleware.js

const Support = require("../models/Support");
const FAQ = require("../models/FAQ");

/**
 * @desc   Check if user owns the ticket
 * @usage  router.get("/tickets/:ticketId", protect, checkTicketOwnership, controller)
 */
const checkTicketOwnership = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;

    const ticket = await Support.findOne({ ticketId, userId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found or you don't have permission to access it",
      });
    }

    // Attach ticket to request for further use
    req.ticket = ticket;
    next();
  } catch (error) {
    console.error("Ticket ownership check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking ticket ownership",
    });
  }
};

/**
 * @desc   Check if ticket can be responded to (not closed)
 * @usage  router.post("/tickets/:ticketId/response", protect, checkTicketCanBeResponded, controller)
 */
const checkTicketCanBeResponded = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;

    const ticket = await Support.findOne({ ticketId, userId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Cannot respond to closed tickets",
      });
    }

    req.ticket = ticket;
    next();
  } catch (error) {
    console.error("Ticket response check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking ticket status",
    });
  }
};

/**
 * @desc   Validate FAQ ID exists
 * @usage  router.post("/faqs/helpful", protect, validateFAQ, controller)
 */
const validateFAQ = async (req, res, next) => {
  try {
    const { faqId } = req.body;

    const faq = await FAQ.findOne({ id: faqId, isActive: true });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    req.faq = faq;
    next();
  } catch (error) {
    console.error("FAQ validation error:", error);
    return res.status(500).json({
      success: false,
      message: "Error validating FAQ",
    });
  }
};

/**
 * @desc   Rate limit for ticket submissions (15 minutes, max 5)
 * @usage  router.post("/tickets", protect, ticketRateLimiter, controller)
 */
const ticketRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const recentTickets = await Support.countDocuments({
      userId,
      type: "support",
      createdAt: { $gte: lastHour },
    });

    if (recentTickets >= 5) {
      return res.status(429).json({
        success: false,
        message:
          "Too many tickets submitted. Please wait before creating more.",
      });
    }

    next();
  } catch (error) {
    console.error("Rate limit error:", error);
    next();
  }
};

/**
 * @desc   Rate limit for feedback submissions (1 hour, max 3)
 * @usage  router.post("/feedback", protect, feedbackRateLimiter, controller)
 */
const feedbackRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const recentFeedback = await Support.countDocuments({
      userId,
      type: "feedback",
      createdAt: { $gte: lastHour },
    });

    if (recentFeedback >= 3) {
      return res.status(429).json({
        success: false,
        message: "Too much feedback submitted. Thank you for your input!",
      });
    }

    next();
  } catch (error) {
    console.error("Rate limit error:", error);
    next();
  }
};

/**
 * @desc   Check if user can view ticket (own ticket or admin)
 * @usage  router.get("/tickets/:ticketId", protect, canViewTicket, controller)
 */
const canViewTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const ticket = await Support.findOne({ ticketId });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Allow if user is admin or ticket owner
    if (userRole === "admin" || ticket.userId.toString() === userId) {
      req.ticket = ticket;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You don't have permission to view this ticket",
    });
  } catch (error) {
    console.error("Ticket view permission error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking ticket permissions",
    });
  }
};

module.exports = {
  checkTicketOwnership,
  checkTicketCanBeResponded,
  validateFAQ,
  ticketRateLimiter,
  feedbackRateLimiter,
  canViewTicket,
};
