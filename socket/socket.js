// socket/socket.js

const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const CalendarEvent = require("../models/CalendarEvent");
const Notification = require("../models/Notification");
const Chat = require("../models/Chat");

let io;
let activeUsers = new Map();
let adminRooms = new Map();

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
  });

  // ============ AUTH MIDDLEWARE ============
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.query.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        console.log(
          "⚠️ No token provided, allowing connection for chat authentication",
        );
        socket.userId = null;
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId || decoded.id).select(
        "_id name email isActive role department",
      );

      if (!user || !user.isActive) {
        console.log("⚠️ User not found or inactive");
        socket.userId = null;
        socket.user = null;
        return next();
      }

      socket.userId = user._id.toString();
      socket.user = user;

      socket.join(`user-${user._id}`);
      socket.join(`calendar-user-${user._id}`);
      socket.join(`user_${user._id}`);

      if (user.department) {
        socket.join(`dept-${user.department}`);
        socket.join(`calendar-dept-${user.department}`);
      }

      if (user.role) {
        socket.join(`role-${user.role}`);
        socket.join(`calendar-role-${user.role}`);
      }

      console.log(
        `🔌 Socket connected: ${user._id} (${user.name}) - Role: ${user.role}`,
      );
      next();
    } catch (error) {
      console.error("Socket auth error:", error.message);
      socket.userId = null;
      socket.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ New client connected: ${socket.id}`);

    socket.emit("connected", {
      success: true,
      userId: socket.userId,
      timestamp: new Date(),
      message: "Connected to socket server",
    });

    // ============ CHAT SUPPORT EVENTS ============

    // Authenticate event for chat
    socket.on("authenticate", async (data) => {
      console.log("🔐 ===== AUTHENTICATE EVENT RECEIVED =====");
      console.log("🔐 Data:", JSON.stringify(data, null, 2));
      console.log("🔐 Socket ID:", socket.id);

      const { userId, role, name, email } = data;

      if (userId) {
        activeUsers.set(userId, socket.id);
        socket.userId = userId;
        socket.role = role || "user";
        socket.name = name;
        socket.email = email;

        console.log(
          `✅ Chat authenticated: ${name} (${userId}) - Role: ${role || "user"}`,
        );

        if (role === "admin") {
          socket.join("admin_room");
          adminRooms.set(userId, "admin_room");

          const activeChats = await Chat.find({
            status: { $in: ["active", "waiting"] },
          })
            .sort({ lastMessageAt: -1 })
            .limit(50);

          socket.emit("active_chats", activeChats);
          console.log("📤 Sent active_chats to admin");
        } else {
          socket.join(`user_${userId}`);
          console.log("🔍 Looking for existing chat session for user:", userId);

          try {
            let activeSession = await Chat.findOne({
              userId,
              status: { $in: ["active", "waiting"] },
            });

            console.log(
              "🔍 Existing session found:",
              activeSession ? "YES" : "NO",
            );
            if (activeSession) {
              console.log("🔍 Session ID:", activeSession.sessionId);
            }

            if (!activeSession) {
              console.log("📝 Creating new chat session...");
              activeSession = await createChatSession(userId, {
                name,
                email,
                ipAddress: socket.handshake.address,
                userAgent: socket.handshake.headers["user-agent"],
                deviceInfo: data.deviceInfo || {},
              });
              console.log(
                "✅ New session created with ID:",
                activeSession.sessionId,
              );
            }

            socket.sessionId = activeSession.sessionId;
            socket.join(`chat_${activeSession.sessionId}`);

            console.log(
              "📤 Sending chat_history to client with session:",
              activeSession.sessionId,
            );
            console.log(
              "📤 Messages count:",
              activeSession.messages?.length || 0,
            );
            socket.emit("chat_history", activeSession);
            console.log("✅ chat_history sent successfully");
          } catch (error) {
            console.error("❌ Error in authenticate handler:", error);
            socket.emit("error", {
              message: "Failed to initialize chat session",
            });
          }
        }
      } else {
        console.log("⚠️ No userId in authenticate data");
      }
    });

    // Send message
    socket.on("send_message", async (data) => {
      console.log("📨 ===== SEND_MESSAGE EVENT RECEIVED =====");
      console.log("📨 Data:", data);
      console.log("📨 Socket role:", socket.role);
      console.log("📨 Socket userId:", socket.userId);

      const { sessionId, message, type = "text", replyTo } = data;

      try {
        const chat = await Chat.findOne({ sessionId });
        if (!chat) {
          console.log("❌ Chat session not found for sessionId:", sessionId);
          socket.emit("error", { message: "Chat session not found" });
          return;
        }

        console.log("✅ Chat found, adding message...");

        const newMessage = {
          messageId: `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
          text: message,
          sender: socket.role === "admin" ? "admin" : "user",
          senderId: socket.userId,
          senderName: socket.name,
          status: "sent",
          type,
          replyTo,
          timestamp: new Date(),
        };

        chat.messages.push(newMessage);
        chat.lastMessage = message;
        chat.lastMessageSender = socket.role === "admin" ? "admin" : "user";
        chat.lastMessageAt = new Date();

        if (socket.role === "admin") {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        } else {
          chat.unreadCount = 0;
        }

        await chat.save();
        const savedMessage = chat.messages[chat.messages.length - 1];

        console.log("✅ Message saved, emitting to room:", `chat_${sessionId}`);

        io.to(`chat_${sessionId}`).emit("new_message", {
          message: savedMessage,
          sessionId,
        });

        if (socket.role === "user" && chat.status === "waiting") {
          io.to("admin_room").emit("new_chat_notification", {
            type: "new_chat",
            sessionId,
            userInfo: chat.userInfo,
            message,
            timestamp: new Date(),
          });
        }

        setTimeout(() => {
          io.to(`chat_${sessionId}`).emit("message_status", {
            messageId: savedMessage.messageId,
            status: "delivered",
          });
        }, 500);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Mark message as read
    socket.on("mark_read", async (data) => {
      const { sessionId, messageIds } = data;

      try {
        const chat = await Chat.findOne({ sessionId });
        if (chat) {
          let updated = false;
          chat.messages.forEach((msg) => {
            if (
              messageIds.includes(msg.messageId) &&
              msg.sender !== socket.role
            ) {
              msg.status = "read";
              msg.readAt = new Date();
              updated = true;
            }
          });

          if (socket.role === "admin") {
            chat.unreadCount = 0;
          }

          if (updated) {
            await chat.save();
          }

          io.to(`chat_${sessionId}`).emit("messages_read", {
            messageIds,
            readBy: socket.role,
            readAt: new Date(),
          });
        }
      } catch (error) {
        console.error("Error marking read:", error);
      }
    });

    // Typing indicators
    socket.on("typing_start", (data) => {
      const { sessionId } = data;
      socket.to(`chat_${sessionId}`).emit("user_typing", {
        userId: socket.userId,
        name: socket.name,
        isTyping: true,
      });
    });

    socket.on("typing_end", (data) => {
      const { sessionId } = data;
      socket.to(`chat_${sessionId}`).emit("user_typing", {
        userId: socket.userId,
        name: socket.name,
        isTyping: false,
      });
    });

    // Assign chat to admin
    socket.on("assign_chat", async (data) => {
      const { sessionId, adminId } = data;

      try {
        const chat = await Chat.findOne({ sessionId });
        if (chat && chat.status === "waiting") {
          chat.status = "active";
          chat.assignedTo = adminId;

          const admin = await User.findById(adminId);
          chat.assignedToName = admin?.name || "Support Agent";
          await chat.save();

          io.to(`user_${adminId}`).emit("chat_assigned", {
            sessionId,
            userInfo: chat.userInfo,
          });

          io.to(`chat_${sessionId}`).emit("chat_assigned", {
            assignedTo: chat.assignedToName,
            message: `${chat.assignedToName} has joined the chat`,
          });
        }
      } catch (error) {
        console.error("Error assigning chat:", error);
      }
    });

    // End chat
    socket.on("end_chat", async (data) => {
      const { sessionId, rating, feedback } = data;

      try {
        const chat = await Chat.findOne({ sessionId });
        if (chat) {
          chat.status = "resolved";
          chat.endedAt = new Date();
          chat.resolvedAt = new Date();

          if (rating) {
            chat.rating = {
              score: rating,
              comment: feedback,
              givenAt: new Date(),
            };
          }

          await chat.save();

          io.to(`chat_${sessionId}`).emit("chat_ended", {
            message:
              "Chat session has ended. Thank you for contacting support!",
          });
        }
      } catch (error) {
        console.error("Error ending chat:", error);
      }
    });

    // ============ CALENDAR EVENTS ============

    socket.on("calendar:subscribe", (data) => {
      const { userId, eventId, date } = data;

      if (eventId) {
        socket.join(`calendar-event-${eventId}`);
        socket.emit("calendar:subscribed-event", { eventId, success: true });
      }

      if (date) {
        socket.join(`calendar-date-${date}`);
        socket.emit("calendar:subscribed-date", { date, success: true });
      }

      socket.join(`calendar-user-subscriptions-${socket.userId}`);
    });

    socket.on("calendar:event-created", (data) => {
      const { event, userId } = data;
      socket.emit("calendar:new-event", {
        event,
        type: "created",
        timestamp: new Date(),
      });

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

    socket.on("notification:read", async (data) => {
      try {
        const { notificationId } = data;
        if (notificationId) {
          await Notification.findOneAndUpdate(
            { _id: notificationId, userId: socket.userId },
            { read: true, readAt: new Date() },
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

    socket.on("notification:read-all", async () => {
      try {
        const result = await Notification.updateMany(
          { userId: socket.userId, read: false },
          { read: true, readAt: new Date() },
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

    socket.on("notification:unread-count", async () => {
      try {
        const count = await Notification.countDocuments({
          userId: socket.userId,
          read: false,
        });
        socket.emit("notification:unread-count", { success: true, count });
      } catch (error) {
        console.error("Get unread count error:", error);
        socket.emit("notification:error", {
          success: false,
          message: "Failed to get unread count",
        });
      }
    });

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

        io.to(`calendar-event-${eventId}`).emit("calendar:status-changed", {
          eventId,
          status,
          event: { id: event._id, title: event.title, type: event.type },
          updatedBy: socket.userId,
          timestamp: new Date(),
        });

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

    socket.on("calendar:reminder-ack", async (data) => {
      const { eventId, reminderId } = data;
      console.log(
        `User ${socket.userId} acknowledged reminder for event ${eventId}`,
      );
      socket.emit("calendar:reminder-acknowledged", {
        success: true,
        eventId,
        reminderId,
        timestamp: new Date(),
      });
    });

    // ============ HEARTBEAT/PING ============

    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date(), userId: socket.userId });
    });

    // ============ ERROR HANDLING ============

    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });

    // ============ DISCONNECT HANDLER ============

    socket.on("disconnect", (reason) => {
      console.log(
        `❌ User disconnected: ${socket.userId || socket.id}, Reason: ${reason}`,
      );

      if (socket.userId) {
        activeUsers.delete(socket.userId);
        if (socket.role === "user" && socket.sessionId) {
          Chat.findOne({ sessionId: socket.sessionId })
            .then((chat) => {
              if (chat && chat.status === "active") {
                chat.status = "waiting";
                chat.save();
                io.to("admin_room").emit("user_disconnected", {
                  sessionId: socket.sessionId,
                  userId: socket.userId,
                  userName: socket.name,
                });
              }
            })
            .catch(console.error);
        }
        if (socket.role === "admin") {
          adminRooms.delete(socket.userId);
        }
      }

      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room !== socket.id) socket.leave(room);
      });
    });
  });

  return io;
};

// ============ HELPER FUNCTIONS ============

async function createChatSession(userId, userData) {
  try {
    console.log("📝 Creating new chat session for user:", userId);
    const chat = new Chat({
      userId,
      userInfo: {
        name: userData.name,
        email: userData.email,
        ipAddress: userData.ipAddress,
        userAgent: userData.userAgent,
      },
      status: "waiting",
      startedAt: new Date(),
      lastMessageAt: new Date(),
      metadata: {
        deviceInfo: userData.deviceInfo || {},
        browser: userData.userAgent || "mobile",
      },
    });
    const savedChat = await chat.save();
    console.log("✅ Chat session created with ID:", savedChat.sessionId);
    return savedChat;
  } catch (error) {
    console.error("❌ Error creating chat session:", error);
    throw error;
  }
}

const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

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
    if (
      event.assignedTo &&
      event.assignedTo.toString() !== performedBy._id.toString()
    ) {
      io.to(`user-${event.assignedTo}`).emit(
        "calendar:notification",
        notificationData,
      );
    }
    if (
      event.createdBy &&
      event.createdBy.toString() !== performedBy._id.toString()
    ) {
      io.to(`user-${event.createdBy}`).emit(
        "calendar:notification",
        notificationData,
      );
    }
    if (performedBy.department) {
      io.to(`calendar-dept-${performedBy.department}`).emit(
        "calendar:department-update",
        {
          ...notificationData,
          department: performedBy.department,
        },
      );
    }
    io.to(`calendar-updates`).emit("calendar:activity", notificationData);
  } catch (error) {
    console.error("Send calendar notification error:", error);
  }
};

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
    if (event.assignedTo) {
      io.to(`user-${event.assignedTo._id}`).emit(
        "calendar:reminder",
        reminderData,
      );
    }
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

const sendDailyAgenda = async (userId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const events = await CalendarEvent.find({
      assignedTo: userId,
      date: { $gte: today, $lt: tomorrow },
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
      io.to(`user-${userId}`).emit("calendar:daily-agenda", agendaData);
    }
  } catch (error) {
    console.error("Send daily agenda error:", error);
  }
};

global.sendCalendarNotification = sendCalendarNotification;
global.sendEventReminder = sendEventReminder;
global.sendDailyAgenda = sendDailyAgenda;

module.exports = { initSocket, getIO };
