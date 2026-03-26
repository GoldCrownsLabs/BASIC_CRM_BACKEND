// routes/chatRoutes.js

const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/auth"); // ✅ Use existing protect and admin
const Chat = require("../models/Chat");

// Get user's chat history
router.get("/my-chats", protect, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id })
      .sort({ lastMessageAt: -1 })
      .select("-messages")
      .limit(50);

    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get specific chat session
router.get("/session/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    // Check permission
    if (req.user.role !== "admin" && chat.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    console.error("Error fetching chat session:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all active chats (admin only)
router.get("/admin/active", protect, admin, async (req, res) => {
  try {
    const chats = await Chat.find({
      status: { $in: ["active", "waiting"] },
    })
      .sort({ lastMessageAt: -1 })
      .populate("assignedTo", "name email");

    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    console.error("Error fetching active chats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get chat statistics (admin only)
router.get("/admin/statistics", protect, admin, async (req, res) => {
  try {
    const stats = await Chat.aggregate([
      {
        $facet: {
          totalChats: [{ $count: "count" }],
          activeChats: [{ $match: { status: "active" } }, { $count: "count" }],
          waitingChats: [
            { $match: { status: "waiting" } },
            { $count: "count" },
          ],
          resolvedToday: [
            {
              $match: {
                resolvedAt: {
                  $gte: new Date().setHours(0, 0, 0, 0),
                },
              },
            },
            { $count: "count" },
          ],
          averageResponseTime: [
            {
              $match: {
                messages: { $exists: true, $ne: [] },
                "messages.1": { $exists: true },
              },
            },
            {
              $project: {
                firstResponseTime: {
                  $subtract: [
                    { $arrayElemAt: ["$messages.timestamp", 1] },
                    { $arrayElemAt: ["$messages.timestamp", 0] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                avgTime: { $avg: "$firstResponseTime" },
              },
            },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    console.error("Error fetching chat statistics:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
