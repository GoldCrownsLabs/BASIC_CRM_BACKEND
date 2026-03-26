// routes/supportRoutes.js

const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const rateLimit = require("express-rate-limit");

// Import middleware
const { protect, admin } = require("../middleware/auth");
const supportMiddleware = require("../middleware/supportMiddleware");

// Import controller
const supportController = require("../controllers/supportController");

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP",
});

// Validation rules
const ticketValidation = [
  body("name").notEmpty().withMessage("Name is required").trim(),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("subject").notEmpty().withMessage("Subject is required").trim(),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Message must be at least 10 characters"),
  body("faqCategory").optional().isString(),
  body("deviceInfo").optional().isObject(),
];

const feedbackValidation = [
  body("name").notEmpty().withMessage("Name is required").trim(),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("comment").optional().trim().isLength({ max: 500 }),
  body("deviceInfo").optional().isObject(),
];

const responseValidation = [
  body("message").notEmpty().withMessage("Message is required").trim(),
  body("attachments").optional().isArray(),
];

const faqHelpfulnessValidation = [
  body("faqId").isInt().withMessage("FAQ ID must be a number"),
  body("helpful").isBoolean().withMessage("Helpful must be boolean"),
];

// ============ PUBLIC ROUTES ============
router.get("/faqs", apiLimiter, supportController.getFAQs);
router.get("/faqs/categories", apiLimiter, supportController.getFAQCategories);
router.post(
  "/faqs/helpful",
  apiLimiter,
  faqHelpfulnessValidation,
  supportMiddleware.validateFAQ,
  supportController.trackFAQHelpfulness,
);
router.post(
  "/tickets",
  apiLimiter,
  ticketValidation,
  supportController.submitTicket,
);
router.post(
  "/feedback",
  apiLimiter,
  feedbackValidation,
  supportController.submitFeedback,
);

// ============ PROTECTED ROUTES (Authentication required) ============
router.use(protect); // All routes below this require authentication

// Ticket routes
router.get("/tickets", supportController.getUserTickets);
router.get(
  "/tickets/:ticketId",
  [param("ticketId").notEmpty().withMessage("Ticket ID is required")],
  supportMiddleware.canViewTicket,
  supportController.getTicket,
);
router.post(
  "/tickets/:ticketId/response",
  [param("ticketId").notEmpty().withMessage("Ticket ID is required")],
  responseValidation,
  supportMiddleware.checkTicketCanBeResponded,
  supportController.addResponse,
);

// ============ ADMIN ROUTES ============
router.use(admin); // All routes below this require admin access

router.get("/admin/statistics", supportController.getStatistics);
router.get("/admin/tickets", supportController.getAllTickets);
router.put(
  "/admin/tickets/:ticketId",
  [
    param("ticketId").notEmpty().withMessage("Ticket ID is required"),
    body("status")
      .optional()
      .isIn(["open", "in-progress", "resolved", "closed"]),
    body("priority").optional().isIn(["low", "medium", "high", "urgent"]),
  ],
  supportController.updateTicketStatus,
);

module.exports = router;
