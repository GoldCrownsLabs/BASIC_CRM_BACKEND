const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const calendarAuth = require("../middleware/calendarAuth"); 
const {
  validateEvent,
  validateQuickAddEvent,
  validateEventStatus,
  validateBulkUpdate,
} = require("../middleware/validateEvent");




const {
  getCalendarEvents,
  getEventsByDate,
  getAgendaView,
  getCalendarStats,
} = require("../controllers/calendarController");

// Calendar Routes - Already have userId filter in queries ✅
router.get("/", protect, getCalendarEvents);
router.get("/stats", protect, getCalendarStats);
router.get("/agenda", protect, getAgendaView);
router.get("/date/:date", protect, getEventsByDate);

// ✅ Event Creation - User ID assign ho raha hai
router.post("/", protect, validateEvent, async (req, res) => {
  try {
    const CalendarEvent = require("../models/CalendarEvent");
    const Notification = require("../models/Notification");

    const eventData = {
      ...req.validatedData,
      assignedTo: req.user._id,
      createdBy: req.user._id,
      metadata: {
        createdVia: req.headers["user-agent"]?.includes("Mobile")
          ? "mobile"
          : "web",
      },
    };

    const event = await CalendarEvent.create(eventData);

    // Populate references
    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate("contactId", "name email phone avatar")
      .populate("assignedTo", "name email avatar role")
      .populate("createdBy", "name email");

    // Create notification
    try {
      await Notification.create({
        userId: req.user._id,
        title: "Event Created",
        message: `You created "${eventData.title}" scheduled for ${new Date(eventData.date).toLocaleDateString()} at ${eventData.startTime}`,
        type: "calendar",
        data: {
          eventId: event._id,
          eventType: eventData.type || "meeting",
          action: "created",
        },
        priority: eventData.priority || "medium",
      });

      // Socket notification
      if (global.io) {
        global.io.to(`user_${req.user._id}`).emit("event:created", {
          event: populatedEvent,
          message: "New event created",
        });
      }
    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: populatedEvent,
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ✅ Get single event - WITH OWNERSHIP CHECK
router.get(
  "/event/:id",
  protect,
  calendarAuth.checkEventOwnership,
  async (req, res) => {
    try {
      const event = req.event; // Middleware se mil gaya

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error("Get event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch event",
      });
    }
  },
);

// ✅ UPDATE EVENT - Add ownership check
router.put(
  "/event/:id",
  protect,
  calendarAuth.checkEventOwnership,
  calendarAuth.checkCanModify,
  async (req, res) => {
    try {
      const CalendarEvent = require("../models/CalendarEvent");
      const updatedEvent = await CalendarEvent.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true },
      )
        .populate("contactId", "name email phone avatar")
        .populate("assignedTo", "name email avatar role")
        .populate("createdBy", "name email");

      res.json({
        success: true,
        message: "Event updated successfully",
        data: updatedEvent,
      });
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event",
      });
    }
  },
);

// ✅ DELETE EVENT - Add ownership check
router.delete(
  "/event/:id",
  protect,
  calendarAuth.checkEventOwnership,
  async (req, res) => {
    try {
      const CalendarEvent = require("../models/CalendarEvent");
      await CalendarEvent.findByIdAndDelete(req.params.id);

      // Socket notification for deletion
      if (global.io) {
        global.io.to(`user_${req.user._id}`).emit("event:deleted", {
          eventId: req.params.id,
          message: "Event deleted",
        });
      }

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete event",
      });
    }
  },
);

// ✅ COMPLETE EVENT - Add ownership check
router.patch(
  "/event/:id/complete",
  protect,
  calendarAuth.checkEventOwnership,
  async (req, res) => {
    try {
      const CalendarEvent = require("../models/CalendarEvent");
      const event = await CalendarEvent.findByIdAndUpdate(
        req.params.id,
        {
          status: "completed",
          completedAt: new Date(),
          lastModified: Date.now(),
        },
        { new: true },
      );

      res.json({
        success: true,
        message: "Event marked as completed",
        data: event,
      });
    } catch (error) {
      console.error("Complete event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to complete event",
      });
    }
  },
);

// Event Type Management
router.get("/types", protect, async (req, res) => {
  try {
    const EventType = require("../models/EventType");
    const types = await EventType.find({ isActive: true }).sort("order");
    res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Get event types error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch event types",
    });
  }
});

// Quick Actions - User ID assign ho raha hai ✅
router.post("/quick-add", protect, validateQuickAddEvent, async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      type = "task",
      priority = "medium",
    } = req.validatedData;

    const CalendarEvent = require("../models/CalendarEvent");

    const event = await CalendarEvent.create({
      title,
      date: new Date(date),
      startTime: time,
      type,
      priority,
      assignedTo: req.user._id,
      createdBy: req.user._id,
      status: "scheduled",
      metadata: {
        createdVia: "quick-add",
      },
    });

    // Populate for response
    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Event added successfully",
      data: populatedEvent,
    });
  } catch (error) {
    console.error("Quick add error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});


// Test notification endpoint
router.post("/test-notification", protect, async (req, res) => {
  try {
    const { message = "Test calendar notification" } = req.body;
    const Notification = require("../models/Notification");

    await Notification.create({
      userId: req.user._id,
      title: "Test Notification",
      message: message,
      type: "calendar",
      priority: "medium",
      data: {
        action: "test",
        timestamp: new Date(),
      },
    });

    // Send socket notification
    if (global.io) {
      global.io.to(`user_${req.user._id}`).emit("notification:test", {
        title: "Test Notification",
        message: message,
        type: "calendar",
      });
    }

    res.json({
      success: true,
      message: "Test notification sent successfully",
    });
  } catch (error) {
    console.error("Send test notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test notification",
    });
  }
});

module.exports = router;