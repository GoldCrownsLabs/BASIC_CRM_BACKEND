const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const CalendarEvent = require("../models/CalendarEvent");
const Notification = require("../models/Notification");

let io;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type"],
    },
    transports: ["websocket", "polling"], // ADD THIS for better compatibility
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000, // ADD THIS
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.query.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication error: Token required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId || decoded.id).select(
        "_id name email isActive role department",
      );

      if (!user || !user.isActive) {
        return next(new Error("User not found or inactive"));
      }

      socket.userId = user._id.toString();
      socket.user = user;

      // Join user specific rooms
      socket.join(`user-${user._id}`);
      socket.join(`calendar-user-${user._id}`);

      // FIX: Use consistent room naming
      socket.join(`user_${user._id}`); // For controller compatibility

      // Join calendar related rooms
      socket.join(`calendar-all`);
      socket.join(`calendar-updates`);

      // Join user to their department room if exists
      if (user.department) {
        socket.join(`dept-${user.department}`);
        socket.join(`calendar-dept-${user.department}`);
      }

      // Join role-based rooms
      if (user.role) {
        socket.join(`role-${user.role}`);
        socket.join(`calendar-role-${user.role}`);
      }

      console.log(
        `🔌 Socket connected: ${user._id} (${user.name}) - Rooms: ${Array.from(socket.rooms).join(", ")}`,
      );
      next();
    } catch (error) {
      console.error("Socket auth error:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Send welcome message
    socket.emit("connected", {
      success: true,
      userId: socket.userId,
      timestamp: new Date(),
      message: "Connected to calendar socket server",
    });

    // ========== CALENDAR SPECIFIC EVENTS ==========

    // Subscribe to calendar updates
    socket.on("calendar:subscribe", (data) => {
      const { userId, eventId, date } = data;

      if (eventId) {
        socket.join(`calendar-event-${eventId}`);
        console.log(`User ${socket.userId} subscribed to event ${eventId}`);

        // Send confirmation
        socket.emit("calendar:subscribed-event", {
          eventId,
          success: true,
        });
      }

      if (date) {
        const roomName = `calendar-date-${date}`;
        socket.join(roomName);
        console.log(`User ${socket.userId} subscribed to date ${date}`);

        socket.emit("calendar:subscribed-date", {
          date,
          success: true,
        });
      }

      // FIX: Add general subscription
      socket.join(`calendar-user-subscriptions-${socket.userId}`);
    });

    // Calendar specific events from controller
    socket.on("calendar:event-created", (data) => {
      const { event, userId } = data;

      // Notify the user who created it
      socket.emit("calendar:new-event", {
        event,
        type: "created",
        timestamp: new Date(),
      });

      // Notify assigned user if different
      if (event.assignedTo && event.assignedTo.toString() !== userId) {
        socket.to(`user-${event.assignedTo}`).emit("calendar:event-assigned", {
          event,
          type: "assigned",
          timestamp: new Date(),
        });
      }
    });

    socket.on("calendar:event-updated", (data) => {
      const { event, userId } = data;

      // Notify everyone subscribed to this event
      socket.to(`calendar-event-${event._id}`).emit("calendar:event-changed", {
        event,
        type: "updated",
        updatedBy: userId,
        timestamp: new Date(),
      });
    });

    socket.on("calendar:event-deleted", (data) => {
      const { eventId, userId } = data;

      socket.to(`calendar-event-${eventId}`).emit("calendar:event-removed", {
        eventId,
        type: "deleted",
        deletedBy: userId,
        timestamp: new Date(),
      });
    });

    // Handle notification read from client
    socket.on("notification:read", async (data) => {
      try {
        const { notificationId } = data;

        if (notificationId) {
          await Notification.findOneAndUpdate(
            {
              _id: notificationId,
              userId: socket.userId,
            },
            {
              read: true,
              readAt: new Date(),
            },
          );

          socket.emit("notification:read-confirmed", {
            success: true,
            notificationId,
            readAt: new Date(),
          });
        }
      } catch (error) {
        console.error("Notification read error:", error);
        socket.emit("notification:error", {
          success: false,
          message: "Failed to mark notification as read",
        });
      }
    });

    // Mark all notifications as read
    socket.on("notification:read-all", async () => {
      try {
        const result = await Notification.updateMany(
          {
            userId: socket.userId,
            read: false,
          },
          {
            read: true,
            readAt: new Date(),
          },
        );

        socket.emit("notification:all-read", {
          success: true,
          count: result.modifiedCount || 0,
          message: `Marked ${result.modifiedCount || 0} notifications as read`,
        });
      } catch (error) {
        console.error("Mark all notifications read error:", error);
        socket.emit("notification:error", {
          success: false,
          message: "Failed to mark all notifications as read",
        });
      }
    });

    // Get unread notification count
    socket.on("notification:unread-count", async () => {
      try {
        const count = await Notification.countDocuments({
          userId: socket.userId,
          read: false,
        });

        socket.emit("notification:unread-count", {
          success: true,
          count,
        });
      } catch (error) {
        console.error("Get unread count error:", error);
        socket.emit("notification:error", {
          success: false,
          message: "Failed to get unread count",
        });
      }
    });

    // Handle real-time event status update
    socket.on("calendar:update-status", async (data) => {
      try {
        const { eventId, status } = data;

        const event = await CalendarEvent.findOneAndUpdate(
          {
            _id: eventId,
            $or: [{ assignedTo: socket.userId }, { createdBy: socket.userId }],
          },
          {
            status,
            ...(status === "completed" ? { completedAt: new Date() } : {}),
          },
          { new: true },
        )
          .populate("assignedTo", "name email")
          .populate("createdBy", "name email");

        if (!event) {
          return socket.emit("calendar:error", {
            success: false,
            message: "Event not found or unauthorized",
          });
        }

        // Create notification for status change
        await Notification.create({
          userId: event.assignedTo,
          title: "Event Status Updated",
          message: `"${event.title}" status changed to ${status}`,
          type: "calendar_update",
          data: {
            eventId: event._id,
            oldStatus: event.status,
            newStatus: status,
            action: "status_updated",
          },
          priority: "medium",
        });

        // Emit to all interested parties
        io.to(`calendar-event-${eventId}`).emit("calendar:status-changed", {
          eventId,
          status,
          event: {
            id: event._id,
            title: event.title,
            type: event.type,
          },
          updatedBy: socket.userId,
          timestamp: new Date(),
        });

        // Notify assigned user specifically
        if (
          event.assignedTo &&
          event.assignedTo._id.toString() !== socket.userId
        ) {
          io.to(`user-${event.assignedTo._id}`).emit(
            "calendar:your-event-status-changed",
            {
              eventId,
              status,
              eventTitle: event.title,
              updatedBy: socket.userId,
              timestamp: new Date(),
            },
          );
        }

        socket.emit("calendar:status-updated", {
          success: true,
          eventId,
          status,
          message: `Status updated to ${status}`,
        });
      } catch (error) {
        console.error("Update status error:", error);
        socket.emit("calendar:error", {
          success: false,
          message: "Failed to update status",
        });
      }
    });

    // Handle reminder acknowledgment
    socket.on("calendar:reminder-ack", async (data) => {
      try {
        const { eventId, reminderId } = data;

        // You can update reminder status in database here
        console.log(
          `User ${socket.userId} acknowledged reminder for event ${eventId}`,
        );

        socket.emit("calendar:reminder-acknowledged", {
          success: true,
          eventId,
          reminderId,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Reminder ack error:", error);
      }
    });

    // ========== HEARTBEAT/PING ==========

    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: new Date(),
        userId: socket.userId,
      });
    });

    // ========== ERROR HANDLING ==========

    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });

    // ========== DISCONNECT HANDLER ==========

    socket.on("disconnect", (reason) => {
      console.log(`❌ User disconnected: ${socket.userId}, Reason: ${reason}`);

      // Clean up rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
    });

    // Auto-disconnect after inactivity (optional)
    const disconnectTimer = setTimeout(() => {
      if (socket.connected) {
        socket.disconnect(true);
        console.log(`Auto-disconnected inactive user: ${socket.userId}`);
      }
    }, 3600000); // 1 hour

    // Clear timer on activity
    socket.on("activity", () => {
      clearTimeout(disconnectTimer);
    });
  });

  // ========== HELPER FUNCTIONS FOR CALENDAR NOTIFICATIONS ==========

  // Function to send calendar event notification
  const sendCalendarNotification = async (event, action, performedBy) => {
    if (!io) return;

    try {
      const notificationData = {
        type: "calendar",
        action,
        event: {
          id: event._id,
          title: event.title,
          date: event.date,
          time: event.startTime,
          type: event.type,
        },
        performedBy: {
          id: performedBy._id,
          name: performedBy.name,
          email: performedBy.email,
        },
        timestamp: new Date(),
        message: getNotificationMessage(action, event, performedBy),
      };

      // Send to assigned user
      if (
        event.assignedTo &&
        event.assignedTo.toString() !== performedBy._id.toString()
      ) {
        io.to(`user-${event.assignedTo}`).emit(
          "calendar:notification",
          notificationData,
        );
      }

      // Send to creator if different
      if (
        event.createdBy &&
        event.createdBy.toString() !== performedBy._id.toString()
      ) {
        io.to(`user-${event.createdBy}`).emit(
          "calendar:notification",
          notificationData,
        );
      }

      // Send to department if applicable
      if (performedBy.department) {
        io.to(`calendar-dept-${performedBy.department}`).emit(
          "calendar:department-update",
          {
            ...notificationData,
            department: performedBy.department,
          },
        );
      }

      // Send to all calendar subscribers
      io.to(`calendar-updates`).emit("calendar:activity", notificationData);
    } catch (error) {
      console.error("Send calendar notification error:", error);
    }
  };

  // Function to send event reminder
  const sendEventReminder = async (eventId) => {
    try {
      const event = await CalendarEvent.findById(eventId)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email");

      if (!event) return;

      const reminderData = {
        type: "reminder",
        event: {
          id: event._id,
          title: event.title,
          date: event.date,
          time: event.startTime,
          description: event.description,
        },
        reminderTime: new Date(),
        message: `Reminder: "${event.title}" starts at ${event.startTime}`,
      };

      // Create database notification
      await Notification.create({
        userId: event.assignedTo,
        title: "Event Reminder",
        message: `"${event.title}" starts at ${event.startTime}`,
        type: "calendar_reminder",
        data: {
          eventId: event._id,
          eventType: event.type,
          action: "reminder",
          reminderTime: new Date(),
        },
        priority: "high",
      });

      // Send socket notification to assigned user
      if (event.assignedTo) {
        io.to(`user-${event.assignedTo._id}`).emit(
          "calendar:reminder",
          reminderData,
        );
      }

      // Also send to creator if different
      if (
        event.createdBy &&
        event.createdBy._id.toString() !== event.assignedTo._id.toString()
      ) {
        io.to(`user-${event.createdBy._id}`).emit(
          "calendar:reminder",
          reminderData,
        );
      }

      console.log(`Reminder sent for event: ${event.title}`);
    } catch (error) {
      console.error("Send reminder error:", error);
    }
  };

  // Function to send daily agenda
  const sendDailyAgenda = async (userId) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const events = await CalendarEvent.find({
        assignedTo: userId,
        date: {
          $gte: today,
          $lt: tomorrow,
        },
        status: { $in: ["scheduled", "in-progress"] },
      }).sort({ startTime: 1 });

      if (events.length > 0) {
        const agendaData = {
          type: "daily-agenda",
          date: today.toISOString().split("T")[0],
          events: events.map((event) => ({
            id: event._id,
            title: event.title,
            time: event.startTime,
            type: event.type,
            priority: event.priority,
          })),
          count: events.length,
          message: `You have ${events.length} events scheduled for today`,
        };

        // Create notification
        await Notification.create({
          userId: userId,
          title: "Today's Agenda",
          message: `You have ${events.length} events scheduled for today`,
          type: "calendar",
          data: {
            action: "daily_agenda",
            eventCount: events.length,
            date: today,
          },
          priority: "medium",
        });

        // Send socket event
        io.to(`user-${userId}`).emit("calendar:daily-agenda", agendaData);
      }
    } catch (error) {
      console.error("Send daily agenda error:", error);
    }
  };

  // ========== EXPOSE HELPER FUNCTIONS ==========

  // Make functions available globally
  global.sendCalendarNotification = sendCalendarNotification;
  global.sendEventReminder = sendEventReminder;
  global.sendDailyAgenda = sendDailyAgenda;

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

// Helper function to generate notification messages
const getNotificationMessage = (action, event, user) => {
  const messages = {
    created: `${user.name} created a new event: "${event.title}"`,
    updated: `${user.name} updated the event: "${event.title}"`,
    deleted: `${user.name} deleted the event: "${event.title}"`,
    reminder: `Reminder: "${event.title}" starts soon`,
    status_changed: `${user.name} changed status of "${event.title}" to ${event.status}`,
    assigned: `You've been assigned to "${event.title}" by ${user.name}`,
  };

  return messages[action] || "Calendar update";
};

module.exports = { initSocket, getIO };
