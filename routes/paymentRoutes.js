// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { body } = require("express-validator");
const paymentController = require("../controllers/paymentController");

// Validation middleware
const validateSubscription = [
  body("planId").notEmpty().withMessage("Plan ID is required"),
];

const validatePayment = [
  body("razorpay_payment_id").notEmpty(),
  body("razorpay_subscription_id").notEmpty(),
  body("razorpay_signature").notEmpty(),
];

// All routes are protected
router.use(protect);

// ✅ Admin only - create plans
router.post(
  "/create-plans",
  admin, // 👈 Only admin can create plans
  asyncHandler(paymentController.createDefaultPlans),
);

// Plan routes
router.get("/plans", asyncHandler(paymentController.getPlans));

// Subscription routes
router.post(
  "/create-subscription",
  validateSubscription,
  asyncHandler(paymentController.createSubscription),
);
// Webhook route (no auth, but with signature verification inside controller)

router.post(
  "/verify-payment",
  validatePayment,
  asyncHandler(paymentController.verifyPayment),
);
// User subscription routes

router.get(
  "/my-subscriptions",
  asyncHandler(paymentController.getUserSubscriptions),
);

// Get details of a specific subscription

router.get(
  "/subscription/:id",
  asyncHandler(paymentController.getSubscriptionDetails),
);

// Cancel subscription

router.post(
  "/cancel/:subscriptionId",
  asyncHandler(paymentController.cancelSubscription),
);

// Payment routes
router.get("/history", asyncHandler(paymentController.getPaymentHistory));

// Coupon routes
router.post(
  "/apply-coupon",
  [body("code").notEmpty()],
  asyncHandler(paymentController.applyCoupon),
);

// Admin route to get all payments

module.exports = router;
