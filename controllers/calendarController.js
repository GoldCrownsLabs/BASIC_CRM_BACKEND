const CalendarEvent = require("../models/CalendarEvent");
const mongoose = require("mongoose");
const moment = require("moment");

// Utility function to generate month days
const generateMonthDays = (year, month) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      day: date.getDate(),
      date: date.toISOString().split("T")[0],
      isCurrentMonth: false,
      isToday: false,
      weekDay: date.getDay(),
      events: [],
    });
  }

  // Current month days
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  for (let i = 1; i <= totalDays; i++) {
    const date = new Date(year, month, i);
    const dateStr = date.toISOString().split("T")[0];

    days.push({
      day: i,
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      weekDay: date.getDay(),
      events: [],
    });
  }

  // Next month days
  const totalCells = 42; // 6 weeks
  const remaining = totalCells - days.length;

  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      day: i,
      date: date.toISOString().split("T")[0],
      isCurrentMonth: false,
      isToday: false,
      weekDay: date.getDay(),
      events: [],
    });
  }

  return days;
};

// Get calendar events with filters
const getCalendarEvents = async (req, res) => {
  try {
    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth(),
      view = "month",
      type,
      status,
      priority,
      search,
    } = req.query;

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const filter = {
      $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
    };

    // Add date filter
    filter.date = {
      $gte: startDate,
      $lte: endDate,
    };

    // Add other filters
    if (type && type !== "all") filter.type = type;
    if (status && status !== "all") filter.status = status;
    if (priority && priority !== "all") filter.priority = priority;

    // Search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { contactName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    const events = await CalendarEvent.find(filter)
      .sort({ date: 1, startTime: 1 })
      .populate("contactId", "name email phone avatar")
      .populate("assignedTo", "name email avatar role")
      .populate("createdBy", "name email");

    // Generate month days for calendar view
    const monthDays = generateMonthDays(parseInt(year), parseInt(month));

    // Group events by date
    const eventsByDate = {};
    events.forEach((event) => {
      const dateStr = event.date.toISOString().split("T")[0];
      if (!eventsByDate[dateStr]) {
        eventsByDate[dateStr] = [];
      }

      eventsByDate[dateStr].push({
        id: event._id,
        title: event.title,
        description: event.description,
        type: event.type,
        time: event.startTime,
        endTime: event.endTime,
        duration: event.duration,
        contactName: event.contactName,
        contactId: event.contactId,
        company: event.company,
        location: event.location,
        status: event.status,
        priority: event.priority,
        color: event.color,
        isAllDay: event.isAllDay,
        createdBy: event.createdBy,
        assignedTo: event.assignedTo,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      });
    });

    // Attach events to days
    monthDays.forEach((day) => {
      day.events = eventsByDate[day.date] || [];
    });

    // Hardcoded event types config (since EventType model is optional)
    const eventTypesConfig = {
      meeting: {
        label: "Meeting",
        color: "#3B82F6",
        icon: "users",
        defaultDuration: 60,
      },
      call: {
        label: "Call",
        color: "#10B981",
        icon: "phone",
        defaultDuration: 30,
      },
      email: {
        label: "Email",
        color: "#8B5CF6",
        icon: "mail",
        defaultDuration: 15,
      },
      task: {
        label: "Task",
        color: "#F59E0B",
        icon: "check-circle",
        defaultDuration: 60,
      },
      deadline: {
        label: "Deadline",
        color: "#EF4444",
        icon: "alert-circle",
        defaultDuration: 0,
      },
      reminder: {
        label: "Reminder",
        color: "#8B5CF6",
        icon: "bell",
        defaultDuration: 5,
      },
      appointment: {
        label: "Appointment",
        color: "#EC4899",
        icon: "calendar",
        defaultDuration: 45,
      },
      other: {
        label: "Other",
        color: "#6B7280",
        icon: "more-horizontal",
        defaultDuration: 60,
      },
    };

    // Response
    res.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(year, month).toLocaleString("default", {
          month: "long",
        }),
        days: monthDays,
        events: events,
        stats: {
          total: events.length,
          byType: events.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          }, {}),
          byStatus: events.reduce((acc, event) => {
            acc[event.status] = (acc[event.status] || 0) + 1;
            return acc;
          }, {}),
          byPriority: events.reduce((acc, event) => {
            acc[event.priority] = (acc[event.priority] || 0) + 1;
            return acc;
          }, {}),
        },
        eventTypes: eventTypesConfig,
      },
      config: {
        months: moment.months(),
        weekDays: moment.weekdaysShort(),
        eventConfig: {
          meeting: { label: "Meeting", color: "#3B82F6", icon: "users" },
          call: { label: "Call", color: "#10B981", icon: "phone" },
          email: { label: "Email", color: "#8B5CF6", icon: "mail" },
          task: { label: "Task", color: "#F59E0B", icon: "check-circle" },
          deadline: {
            label: "Deadline",
            color: "#EF4444",
            icon: "alert-circle",
          },
          reminder: { label: "Reminder", color: "#8B5CF6", icon: "bell" },
          appointment: {
            label: "Appointment",
            color: "#EC4899",
            icon: "calendar",
          },
          other: { label: "Other", color: "#6B7280", icon: "more-horizontal" },
        },
        statusConfig: {
          scheduled: { label: "Scheduled", color: "#3B82F6" },
          completed: { label: "Completed", color: "#10B981" },
          cancelled: { label: "Cancelled", color: "#EF4444" },
          postponed: { label: "Postponed", color: "#F59E0B" },
          "in-progress": { label: "In Progress", color: "#8B5CF6" },
        },
        priorityConfig: {
          low: { label: "Low", color: "#10B981" },
          medium: { label: "Medium", color: "#F59E0B" },
          high: { label: "High", color: "#EF4444" },
          urgent: { label: "Urgent", color: "#DC2626" },
        },
      },
    });
  } catch (error) {
    console.error("Get calendar events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar events",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get events for specific date
const getEventsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { type, status, priority, search } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const filter = {
      $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
      date: new Date(date),
    };

    if (type && type !== "all") filter.type = type;
    if (status && status !== "all") filter.status = status;
    if (priority && priority !== "all") filter.priority = priority;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { contactName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    const events = await CalendarEvent.find(filter)
      .sort({ startTime: 1 })
      .populate("contactId", "name email phone avatar")
      .populate("assignedTo", "name email avatar role")
      .populate("createdBy", "name email");

    res.json({
      success: true,
      data: events,
      stats: {
        total: events.length,
        byType: events.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {}),
        byStatus: events.reduce((acc, event) => {
          acc[event.status] = (acc[event.status] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Get events by date error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch events for date",
    });
  }
};

// Get agenda view (all upcoming events)
const getAgendaView = async (req, res) => {
  try {
    const {
      startDate = new Date().toISOString().split("T")[0],
      endDate,
      type,
      status,
      priority,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
    };

    // Date filter
    filter.date = { $gte: new Date(startDate) };
    if (endDate) {
      filter.date.$lte = new Date(endDate);
    }

    if (type && type !== "all") filter.type = type;
    if (status && status !== "all") filter.status = status;
    if (priority && priority !== "all") filter.priority = priority;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { contactName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      CalendarEvent.find(filter)
        .sort({ date: 1, startTime: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("contactId", "name email phone avatar")
        .populate("assignedTo", "name email avatar role")
        .populate("createdBy", "name email"),
      CalendarEvent.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: events,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
      stats: {
        total,
        byType: events.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {}),
        byStatus: events.reduce((acc, event) => {
          acc[event.status] = (acc[event.status] || 0) + 1;
          return acc;
        }, {}),
        upcoming: await CalendarEvent.countDocuments({
          ...filter,
          date: { $gte: new Date() },
        }),
        overdue: await CalendarEvent.countDocuments({
          ...filter,
          date: { $lt: new Date() },
          status: { $in: ["scheduled", "in-progress"] },
        }),
      },
    });
  } catch (error) {
    console.error("Get agenda view error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agenda",
    });
  }
};

// Get dashboard stats
const getCalendarStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalEvents,
      upcomingEvents,
      completedEvents,
      overdueEvents,
      eventsByType,
      eventsByStatus,
      eventsByPriority,
      recentEvents,
    ] = await Promise.all([
      CalendarEvent.countDocuments({
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
      }),
      CalendarEvent.countDocuments({
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        date: { $gte: new Date() },
        status: { $in: ["scheduled", "in-progress"] },
      }),
      CalendarEvent.countDocuments({
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        status: "completed",
      }),
      CalendarEvent.countDocuments({
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        date: { $lt: new Date() },
        status: { $in: ["scheduled", "in-progress"] },
      }),
      CalendarEvent.aggregate([
        {
          $match: {
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          },
        },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      CalendarEvent.aggregate([
        {
          $match: {
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CalendarEvent.aggregate([
        {
          $match: {
            $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          },
        },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      CalendarEvent.find({
        $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
        createdAt: { $gte: thirtyDaysAgo },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("contactId", "name email")
        .populate("assignedTo", "name email"),
    ]);

    // Convert aggregations to objects
    const typeStats = {};
    eventsByType.forEach((stat) => {
      typeStats[stat._id] = stat.count;
    });

    const statusStats = {};
    eventsByStatus.forEach((stat) => {
      statusStats[stat._id] = stat.count;
    });

    const priorityStats = {};
    eventsByPriority.forEach((stat) => {
      priorityStats[stat._id] = stat.count;
    });

    // Weekly trend
    const weeklyTrend = await CalendarEvent.aggregate([
      {
        $match: {
          $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
          date: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          all: totalEvents,
          upcoming: upcomingEvents,
          completed: completedEvents,
          overdue: overdueEvents,
        },
        byType: typeStats,
        byStatus: statusStats,
        byPriority: priorityStats,
        weeklyTrend,
        recentEvents,
      },
    });
  } catch (error) {
    console.error("Get calendar stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar statistics",
    });
  }
};

// Get upcoming events (for notifications/dashboard)
const getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const events = await CalendarEvent.find({
      $or: [{ assignedTo: req.user._id }, { createdBy: req.user._id }],
      date: {
        $gte: now,
        $lte: sevenDaysFromNow,
      },
      status: { $in: ["scheduled", "in-progress"] },
    })
      .sort({ date: 1, startTime: 1 })
      .limit(parseInt(limit))
      .populate("contactId", "name email avatar")
      .populate("assignedTo", "name email avatar");

    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error("Get upcoming events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming events",
    });
  }
};

module.exports = {
  getCalendarEvents,
  getEventsByDate,
  getAgendaView,
  getCalendarStats,
  getUpcomingEvents,
};
