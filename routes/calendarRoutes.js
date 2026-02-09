const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
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

// Calendar Routes
router.get("/", protect, getCalendarEvents);
router.get("/stats", protect, getCalendarStats);
router.get("/agenda", protect, getAgendaView);
// router.get("/upcoming", protect, getUpcomingEvents);
router.get("/date/:date", protect, getEventsByDate);

// Simple create event endpoint (if not in calculatorController)
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

// Simple get single event
router.get("/event/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const CalendarEvent = require("../models/CalendarEvent");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await CalendarEvent.findOne({
      _id: id,
      $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
    })
      .populate("contactId", "name email phone avatar company")
      .populate("assignedTo", "name email avatar role")
      .populate("createdBy", "name email");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

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
});

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

// Quick Actions
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

router.get("/types", protect, async (req, res) => {
  try {
    let EventType;
    try {
      EventType = require("../models/EventType");
    } catch (error) {
      // If EventType model doesn't exist, return default data
      console.warn("EventType model not found, returning default types");
      return res.json({
        success: true,
        data: [
          {
            _id: "1",
            name: "Meeting",
            color: "#3B82F6",
            icon: "users",
            isActive: true,
            order: 1,
          },
          {
            _id: "2",
            name: "Appointment",
            color: "#10B981",
            icon: "calendar",
            isActive: true,
            order: 2,
          },
          {
            _id: "3",
            name: "Task",
            color: "#F59E0B",
            icon: "check-circle",
            isActive: true,
            order: 3,
          },
          {
            _id: "4",
            name: "Reminder",
            color: "#EF4444",
            icon: "bell",
            isActive: true,
            order: 4,
          },
          {
            _id: "5",
            name: "Personal",
            color: "#8B5CF6",
            icon: "user",
            isActive: true,
            order: 5,
          },
        ],
      });
    }

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
      // Optional: Add default data as fallback
      fallbackData: [
        { _id: "1", name: "Meeting", color: "#3B82F6", icon: "users" },
        { _id: "2", name: "Appointment", color: "#10B981", icon: "calendar" },
        { _id: "3", name: "Task", color: "#F59E0B", icon: "check-circle" },
      ],
    });
  }
});

module.exports = router;