// routes/webhookRoutes.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// ✅ Debug - Confirm file is loading
console.log("📡 Loading webhook routes...");

// Razorpay webhook endpoint
router.post("/razorpay", async (req, res) => {
  try {
    console.log("📡 Webhook received:", req.body.event);

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    // Send immediate response
    res.json({ received: true });

    // Process webhook asynchronously
    processWebhook(req.body).catch(console.error);
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Payment success webhook
router.post("/payment-success", async (req, res) => {
  try {
    console.log("💰 Payment success webhook");
    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment failed webhook
router.post("/payment-failed", async (req, res) => {
  try {
    console.log("❌ Payment failed webhook");
    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test webhook
router.get("/test", (req, res) => {
  res.json({
    message: "Webhook endpoint working",
    timestamp: new Date().toISOString(),
  });
});

async function processWebhook(payload) {
  // Process webhook in background
  console.log("Processing webhook:", payload.event);
  // Add your processing logic here
}

console.log("✅ Webhook routes loaded successfully");

module.exports = router;
