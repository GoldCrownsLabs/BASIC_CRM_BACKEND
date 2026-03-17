const stripe = require("../config/stripe");
const crypto = require("crypto");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Coupon = require("../models/Coupon");

// ============================================
// PLAN MANAGEMENT
// ============================================

// @desc    Create/Update default plans
// @route   POST /api/payments/create-plans
// @access  Private/Admin
const createDefaultPlans = async (req, res) => {
  try {
    console.log("📋 Creating/Updating default plans...");

    const defaultPlans = [
      {
        name: "monthly",
        displayName: "Monthly Plan",
        duration: 30,
        price: 999, // $9.99 AUD
        discountPercentage: 0,
        trialDays: 7,
        hasTrial: true,
        popular: false,
        sortOrder: 1,
        billingCycle: 12,
        billingPeriod: "month",
        currency: "aud",
        description: "Best for individuals and small teams getting started",
        features: [
          { name: "Basic CRM Features", included: true },
          { name: "Up to 100 Leads", included: true, limit: 100 },
          { name: "Up to 100 Contacts", included: true, limit: 100 },
          { name: "Up to 50 Tasks", included: true, limit: 50 },
          { name: "Email Support", included: true },
          { name: "Basic Reports", included: true },
          { name: "Mobile App Access", included: true },
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
        // Stripe Price ID - to be added after creating in Stripe Dashboard
        stripePriceId: process.env.STRIPE_PRICE_MONTHLY,
      },
      {
        name: "quarterly",
        displayName: "Quarterly Plan",
        duration: 90,
        price: 2697, // $26.97 AUD
        discountPercentage: 10,
        trialDays: 7,
        hasTrial: true,
        popular: true,
        sortOrder: 2,
        billingCycle: 4,
        billingPeriod: "quarter",
        currency: "aud",
        description: "Perfect for growing businesses with 10% savings",
        features: [
          { name: "All Monthly Features", included: true },
          { name: "Up to 500 Leads", included: true, limit: 500 },
          { name: "Up to 500 Contacts", included: true, limit: 500 },
          { name: "Up to 200 Tasks", included: true, limit: 200 },
          { name: "Advanced Reports", included: true },
          { name: "Email Campaigns", included: true },
          { name: "Priority Support", included: true },
          { name: "Team Collaboration", included: true },
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
        stripePriceId: process.env.STRIPE_PRICE_QUARTERLY,
      },
      {
        name: "yearly",
        displayName: "Yearly Plan",
        duration: 365,
        price: 8999, // $89.99 AUD
        discountPercentage: 25,
        trialDays: 14,
        hasTrial: true,
        popular: true,
        sortOrder: 3,
        billingCycle: 1,
        billingPeriod: "year",
        currency: "aud",
        description: "Best value with 25% savings",
        features: [
          { name: "All Quarterly Features", included: true },
          { name: "Unlimited Leads", included: true },
          { name: "Unlimited Contacts", included: true },
          { name: "Unlimited Tasks", included: true },
          { name: "Premium Support", included: true },
          { name: "API Access", included: true },
          { name: "Custom Integration", included: true },
        ],
        featureAccess: {
          maxUsers: 10,
          maxLeads: 10000,
          maxContacts: 10000,
          maxTasks: 2000,
          maxProjects: 50,
          maxStorage: 20480,
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
        stripePriceId: process.env.STRIPE_PRICE_YEARLY,
      },
    ];

    const results = [];
    let updated = 0;
    let created = 0;

    for (const planData of defaultPlans) {
      const plan = await Plan.findOneAndUpdate(
        { name: planData.name },
        planData,
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      );

      results.push({
        name: planData.name,
        status: plan.isNew ? "created" : "updated",
        id: plan._id,
        price: plan.price,
      });

      if (plan.isNew) {
        created++;
        console.log(
          `✅ Created plan: ${planData.displayName} - A$${planData.price / 100}`,
        );
      } else {
        updated++;
        console.log(
          `🔄 Updated plan: ${planData.displayName} - A$${planData.price / 100}`,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Default plans processed",
      data: {
        created,
        updated,
        total: defaultPlans.length,
        details: results,
      },
    });
  } catch (error) {
    console.error("❌ Error creating/updating plans:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all active plans
// @route   GET /api/payments/plans
// @access  Private
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({
      sortOrder: 1,
      price: 1,
    });

    // Format prices for display
    const formattedPlans = plans.map((plan) => ({
      ...plan.toObject(),
      formattedPrice: new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: plan.currency || "AUD",
      }).format(plan.price / 100),
    }));

    res.json({
      success: true,
      count: plans.length,
      data: formattedPlans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

// @desc    Create checkout session for subscription
// @route   POST /api/payments/create-checkout-session
// @access  Private
const createCheckoutSession = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    const userId = req.user.id;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    if (!plan.stripePriceId) {
      return res.status(400).json({
        success: false,
        message: "Plan not configured for payments. Please contact admin.",
      });
    }

    // Apply coupon if provided
    let discountId = null;
    if (couponCode) {
      const coupon = await validateCoupon(couponCode, plan, userId);
      if (coupon && coupon.stripeCouponId) {
        discountId = coupon.stripeCouponId;
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      discounts: discountId ? [{ coupon: discountId }] : [],
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req.user.email,
      client_reference_id: userId,
      metadata: {
        userId,
        planId: plan._id.toString(),
        planName: plan.name,
        couponCode: couponCode || "",
      },
      subscription_data: {
        trial_period_days: req.user.trialEligible ? plan.trialDays : 0,
        metadata: {
          userId,
          planId: plan._id.toString(),
        },
      },
    });

    // Create subscription record in database
    const subscription = await Subscription.create({
      userId,
      planId: plan._id,
      stripeSubscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      status: "pending",
      amount: plan.price,
      billingCycle: {
        current: 1,
        total: plan.billingCycle || 12,
        period: plan.billingPeriod || "month",
      },
      metadata: {
        checkoutSessionId: session.id,
        couponCode: couponCode || "",
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionUrl: session.url,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      },
    });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create payment intent for one-time payment
// @route   POST /api/payments/create-payment-intent
// @access  Private
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = "aud" } = req.body;
    const userId = req.user.id;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: {
        userId,
      },
    });

    // Create payment record
    await Payment.create({
      userId,
      stripePaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    console.error("Payment intent creation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify payment/session
// @route   POST /api/payments/verify-payment
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer", "line_items"],
    });

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    // Find subscription in database
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: session.subscription.id,
    }).populate("planId");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Update subscription status
    subscription.status = "active";
    subscription.stripeCustomerId = session.customer.id;
    subscription.activatedAt = new Date();
    subscription.currentPeriodStart = new Date(
      session.subscription.current_period_start * 1000,
    );
    subscription.currentPeriodEnd = new Date(
      session.subscription.current_period_end * 1000,
    );
    await subscription.save();

    // Create payment record
    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.subscription.latest_invoice?.payment_intent,
    );

    if (paymentIntent) {
      await Payment.create({
        userId: subscription.userId,
        subscriptionId: subscription._id,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: session.customer.id,
        stripeSubscriptionId: session.subscription.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: "succeeded",
        paymentMethodType: paymentIntent.payment_method_types?.[0],
        paidAt: new Date(),
      });
    }

    // Update user's current subscription
    await User.findByIdAndUpdate(subscription.userId, {
      currentSubscription: subscription._id,
      subscriptionStatus: "active",
    });

    res.json({
      success: true,
      message: "Payment verified successfully",
      data: {
        subscription,
        session,
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get user subscriptions
// @route   GET /api/payments/my-subscriptions
// @access  Private
const getUserSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.user.id })
      .populate("planId")
      .sort({ createdAt: -1 });

    // Sync with Stripe for active subscriptions
    for (const sub of subscriptions) {
      if (
        sub.stripeSubscriptionId &&
        ["active", "trialing"].includes(sub.status)
      ) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(
            sub.stripeSubscriptionId,
          );
          if (stripeSub.status !== sub.status) {
            sub.status = stripeSub.status;
            sub.currentPeriodEnd = new Date(
              stripeSub.current_period_end * 1000,
            );
            await sub.save();
          }
        } catch (stripeError) {
          console.log(
            "Error syncing subscription with Stripe:",
            stripeError.message,
          );
        }
      }
    }

    res.json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get subscription details
// @route   GET /api/payments/subscription/:id
// @access  Private
const getSubscriptionDetails = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("planId");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Get latest from Stripe if active
    if (
      subscription.stripeSubscriptionId &&
      ["active", "trialing"].includes(subscription.status)
    ) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
          { expand: ["latest_invoice", "default_payment_method"] },
        );

        subscription.currentPeriodEnd = new Date(
          stripeSub.current_period_end * 1000,
        );
        subscription.status = stripeSub.status;
        await subscription.save();
      } catch (stripeError) {
        console.log("Error fetching from Stripe:", stripeError.message);
      }
    }

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Cancel subscription
// @route   POST /api/payments/cancel/:subscriptionId
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Cancel in Stripe
    if (subscription.stripeSubscriptionId) {
      try {
        const canceledStripeSub = await stripe.subscriptions.cancel(
          subscription.stripeSubscriptionId,
          { cancellation_details: { comment: reason } },
        );
        console.log("Canceled in Stripe:", canceledStripeSub.id);
      } catch (stripeError) {
        console.log("Stripe cancellation error:", stripeError.message);
      }
    }

    // Update in database
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    subscription.cancellationReason = reason;
    subscription.autoRenew = false;
    await subscription.save();

    // Remove from user's current subscription if it's this one
    const user = await User.findById(req.user.id);
    if (user.currentSubscription?.toString() === subscriptionId) {
      await User.findByIdAndUpdate(req.user.id, {
        $unset: { currentSubscription: 1 },
        subscriptionStatus: "canceled",
      });
    }

    res.json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Pause subscription
// @route   POST /api/payments/pause/:subscriptionId
// @access  Private
const pauseSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { pauseBehavior = "void" } = req.body;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.stripeSubscriptionId) {
      const pausedSub = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          pause_collection: {
            behavior: pauseBehavior,
          },
        },
      );

      subscription.status = "paused";
      subscription.pausedAt = new Date();
      await subscription.save();
    }

    res.json({
      success: true,
      message: "Subscription paused successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("Pause subscription error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Resume subscription
// @route   POST /api/payments/resume/:subscriptionId
// @access  Private
const resumeSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.stripeSubscriptionId) {
      const resumedSub = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          pause_collection: "",
        },
      );

      subscription.status = "active";
      subscription.pausedAt = null;
      await subscription.save();
    }

    res.json({
      success: true,
      message: "Subscription resumed successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("Resume subscription error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// PAYMENT HISTORY
// ============================================

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate("subscriptionId")
      .sort({ createdAt: -1 })
      .limit(50);

    // Format amounts for display
    const formattedPayments = payments.map((payment) => ({
      ...payment.toObject(),
      formattedAmount: new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: payment.currency || "AUD",
      }).format(payment.amount / 100),
    }));

    res.json({
      success: true,
      count: formattedPayments.length,
      data: formattedPayments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:paymentId
// @access  Private
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.user.id,
    }).populate("subscriptionId");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Get latest from Stripe if needed
    if (payment.stripePaymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          payment.stripePaymentIntentId,
        );

        if (paymentIntent.status !== payment.status) {
          payment.status = paymentIntent.status;
          await payment.save();
        }
      } catch (stripeError) {
        console.log("Error fetching from Stripe:", stripeError.message);
      }
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// COUPON MANAGEMENT
// ============================================

// Helper function to validate coupon
const validateCoupon = async (code, plan, userId) => {
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  });

  if (!coupon) {
    throw new Error("Invalid or expired coupon");
  }

  if (
    coupon.applicablePlans.length > 0 &&
    !coupon.applicablePlans.includes(plan.name)
  ) {
    throw new Error("Coupon not applicable for this plan");
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new Error("Coupon usage limit exceeded");
  }

  const existingUsage = await Subscription.countDocuments({
    userId,
    "metadata.couponCode": code.toUpperCase(),
  });

  if (existingUsage >= coupon.perUserLimit) {
    throw new Error("You have already used this coupon");
  }

  return coupon;
};

// @desc    Apply coupon
// @route   POST /api/payments/apply-coupon
// @access  Private
const applyCoupon = async (req, res) => {
  try {
    const { code, planId } = req.body;
    const userId = req.user.id;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const coupon = await validateCoupon(code, plan, userId);

    let discountAmount = 0;
    let finalPrice = plan.price;

    if (coupon.discountType === "percentage") {
      discountAmount = (plan.price * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount * 100); // Convert to cents
      }
    } else {
      discountAmount = coupon.discountValue * 100; // Convert to cents
    }

    discountAmount = Math.min(discountAmount, plan.price);
    finalPrice = plan.price - discountAmount;

    // If coupon has Stripe ID, include it
    let stripeCouponId = null;
    if (coupon.stripeCouponId) {
      stripeCouponId = coupon.stripeCouponId;
    }

    res.json({
      success: true,
      data: {
        couponCode: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount / 100,
        originalPrice: plan.price / 100,
        finalPrice: finalPrice / 100,
        stripeCouponId,
        message: "Coupon applied successfully",
      },
    });
  } catch (error) {
    console.error("Coupon error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create coupon in Stripe and database (Admin only)
// @route   POST /api/payments/create-coupon
// @access  Private/Admin
const createCoupon = async (req, res) => {
  try {
    const couponData = req.body;

    // Create coupon in Stripe first
    let stripeCoupon = null;
    try {
      stripeCoupon = await stripe.coupons.create({
        name: couponData.code,
        percent_off:
          couponData.discountType === "percentage"
            ? couponData.discountValue
            : undefined,
        amount_off:
          couponData.discountType === "fixed"
            ? couponData.discountValue * 100
            : undefined,
        currency: "aud",
        duration: "once",
        max_redemptions: couponData.usageLimit,
        redeem_by: Math.floor(new Date(couponData.validUntil).getTime() / 1000),
      });
    } catch (stripeError) {
      console.log("Stripe coupon creation error:", stripeError.message);
      // Continue even if Stripe creation fails - we'll still create in DB
    }

    const coupon = await Coupon.create({
      ...couponData,
      code: couponData.code.toUpperCase(),
      stripeCouponId: stripeCoupon?.id,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all coupons (Admin only)
// @route   GET /api/payments/coupons
// @access  Private/Admin
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: coupons.length,
      data: coupons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single coupon (Admin only)
// @route   GET /api/payments/coupons/:id
// @access  Private/Admin
const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }
    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update coupon (Admin only)
// @route   PUT /api/payments/coupons/:id
// @access  Private/Admin
const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }
    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete coupon (Admin only)
// @route   DELETE /api/payments/coupons/:id
// @access  Private/Admin
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Also delete from Stripe if it has a Stripe ID
    if (coupon.stripeCouponId) {
      try {
        await stripe.coupons.del(coupon.stripeCouponId);
      } catch (stripeError) {
        console.log("Error deleting Stripe coupon:", stripeError.message);
      }
    }

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// @desc    Get or create Stripe customer
// @route   POST /api/payments/get-or-create-customer
// @access  Private
const getOrCreateCustomer = async (req, res) => {
  try {
    const user = req.user;

    // Check if user already has a Stripe customer ID
    if (user.stripeCustomerId) {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      return res.json({
        success: true,
        data: {
          customerId: customer.id,
          email: customer.email,
          name: customer.name,
        },
      });
    }

    // Create new customer in Stripe
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      phone: user.phone,
      metadata: {
        userId: user._id.toString(),
      },
    });

    // Save customer ID to user
    await User.findByIdAndUpdate(user._id, {
      stripeCustomerId: customer.id,
    });

    res.json({
      success: true,
      data: {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
      },
    });
  } catch (error) {
    console.error("Get or create customer error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get customer payment methods
// @route   GET /api/payments/payment-methods
// @access  Private
const getPaymentMethods = async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeCustomerId) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    res.json({
      success: true,
      data: paymentMethods.data,
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Set default payment method
// @route   PUT /api/payments/set-default-payment-method/:paymentMethodId
// @access  Private
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const user = req.user;

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: "No Stripe customer found",
      });
    }

    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({
      success: true,
      message: "Default payment method updated",
    });
  } catch (error) {
    console.error("Set default payment method error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Detach payment method
// @route   DELETE /api/payments/payment-methods/:paymentMethodId
// @access  Private
const detachPaymentMethod = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({
      success: true,
      message: "Payment method removed",
    });
  } catch (error) {
    console.error("Detach payment method error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Plan management
  createDefaultPlans,
  getPlans,

  // Subscription management
  createCheckoutSession,
  createPaymentIntent,
  verifyPayment,
  getUserSubscriptions,
  getSubscriptionDetails,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,

  // Payment history
  getPaymentHistory,
  getPaymentById,

  // Coupon management
  applyCoupon,
  createCoupon,
  getCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,

  // Customer management
  getOrCreateCustomer,
  getPaymentMethods,
  setDefaultPaymentMethod,
  detachPaymentMethod,
};
