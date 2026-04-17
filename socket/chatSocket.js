// socket/chatSocket.js

const Chat = require("../models/Chat");
const User = require("../models/User");

class ChatSocket {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map(); // userId -> socketId
    this.userSessions = new Map(); // userId -> active chat sessions
    this.adminRooms = new Map(); // adminId -> room name
  }


  // Initialize socket connections and event handlers
  initialize() {
    this.io.on("connection", (socket) => {
      console.log("🔌 New client connected:", socket.id);

      // User Authentication
      socket.on("authenticate", async (data) => {
        const { userId, role, name, email } = data;

        if (userId) {
          this.activeUsers.set(userId, socket.id);
          socket.userId = userId;
          socket.role = role || "user";
          socket.name = name;
          socket.email = email;

          console.log(
            `✅ User authenticated: ${name} (${userId}) - Role: ${role || "user"}`,
          );

          // Join appropriate room
          if (role === "admin") {
            socket.join("admin_room");
            this.adminRooms.set(userId, "admin_room");

            // Send active chat list to admin
            const activeChats = await Chat.find({
              status: { $in: ["active", "waiting"] },
            })
              .sort({ lastMessageAt: -1 })
              .limit(50);

            socket.emit("active_chats", activeChats);
          } else {
            // User joins their own room
            socket.join(`user_${userId}`);

            // Check if user has active chat session
            let activeSession = await Chat.findOne({
              userId,
              status: { $in: ["active", "waiting"] },
            });

            if (!activeSession) {
              // Create new session if none exists
              activeSession = await this.createChatSession(userId, {
                name,
                email,
                ipAddress: socket.handshake.address,
                userAgent: socket.handshake.headers["user-agent"],
                deviceInfo: data.deviceInfo || {},
              });
            }

            socket.sessionId = activeSession.sessionId;
            socket.join(`chat_${activeSession.sessionId}`);

            // Send chat history
            socket.emit("chat_history", activeSession);
          }
        }
      });

      // Send Message
      socket.on("send_message", async (data) => {
        const { sessionId, message, type = "text", replyTo } = data;

        try {
          const chat = await Chat.findOne({ sessionId });
          if (!chat) {
            socket.emit("error", { message: "Chat session not found" });
            return;
          }

          // Add message to database
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

          // Update unread count for other party
          if (socket.role === "admin") {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
          } else {
            chat.unreadCount = 0;
          }

          await chat.save();

          const savedMessage = chat.messages[chat.messages.length - 1];

          // Emit to all participants in the chat room
          this.io.to(`chat_${sessionId}`).emit("new_message", {
            message: savedMessage,
            sessionId,
          });

          // If user is sending and admin is offline, send notification
          if (socket.role === "user" && chat.status === "waiting") {
            this.notifyAdmins({
              type: "new_chat",
              sessionId,
              userInfo: chat.userInfo,
              message,
              timestamp: new Date(),
            });
          }

          // Update message status to delivered after 500ms
          setTimeout(() => {
            this.io.to(`chat_${sessionId}`).emit("message_status", {
              messageId: savedMessage.messageId,
              status: "delivered",
            });

            // Update in database
            const msgIndex = chat.messages.findIndex(
              (m) => m.messageId === savedMessage.messageId,
            );
            if (msgIndex !== -1) {
              chat.messages[msgIndex].status = "delivered";
              chat.save();
            }
          }, 500);
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Mark Message as Read
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

            this.io.to(`chat_${sessionId}`).emit("messages_read", {
              messageIds,
              readBy: socket.role,
              readAt: new Date(),
            });
          }
        } catch (error) {
          console.error("Error marking read:", error);
        }
      });

      // User Typing Indicator
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

      // Assign Chat to Admin
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

            // Notify admin
            this.io.to(`admin_${adminId}`).emit("chat_assigned", {
              sessionId,
              userInfo: chat.userInfo,
            });

            // Notify user
            this.io.to(`chat_${sessionId}`).emit("chat_assigned", {
              assignedTo: chat.assignedToName,
              message: `${chat.assignedToName} has joined the chat`,
            });
          }
        } catch (error) {
          console.error("Error assigning chat:", error);
        }
      });

      // Transfer Chat to Another Admin
      socket.on("transfer_chat", async (data) => {
        const { sessionId, newAdminId, reason } = data;

        try {
          const chat = await Chat.findOne({ sessionId });
          if (chat && chat.assignedTo) {
            const oldAdmin = chat.assignedTo;
            chat.assignedTo = newAdminId;
            chat.transferredAt = new Date();
            chat.transferredFrom = oldAdmin;

            const newAdmin = await User.findById(newAdminId);
            chat.assignedToName = newAdmin?.name;

            await chat.save();

            // Notify old admin
            this.io.to(`admin_${oldAdmin}`).emit("chat_transferred", {
              sessionId,
              to: newAdmin?.name,
              reason,
            });

            // Notify new admin
            this.io.to(`admin_${newAdminId}`).emit("chat_transferred_in", {
              sessionId,
              userInfo: chat.userInfo,
            });

            // Notify user
            this.io.to(`chat_${sessionId}`).emit("system_message", {
              message: `Chat transferred to ${newAdmin?.name}`,
            });
          }
        } catch (error) {
          console.error("Error transferring chat:", error);
        }
      });

      // End/Resolve Chat
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

            // Notify all participants
            this.io.to(`chat_${sessionId}`).emit("chat_ended", {
              message:
                "Chat session has ended. Thank you for contacting support!",
            });

            // Leave room
            socket.leave(`chat_${sessionId}`);
          }
        } catch (error) {
          console.error("Error ending chat:", error);
        }
      });

      // Disconnect
      socket.on("disconnect", async () => {
        console.log("🔌 Client disconnected:", socket.id);

        // Remove from active users
        if (socket.userId) {
          this.activeUsers.delete(socket.userId);

          // If user had active chat, mark as waiting
          if (socket.role === "user" && socket.sessionId) {
            const chat = await Chat.findOne({ sessionId: socket.sessionId });
            if (chat && chat.status === "active") {
              chat.status = "waiting";
              await chat.save();

              // Notify admins
              this.io.to("admin_room").emit("user_disconnected", {
                sessionId: socket.sessionId,
                userId: socket.userId,
                userName: socket.name,
              });
            }
          }

          // If admin, remove from admin rooms
          if (socket.role === "admin") {
            this.adminRooms.delete(socket.userId);
          }
        }
      });
    });
  }

  // Create new chat session
  async createChatSession(userId, userData) {
    const chat = new Chat({
      userId,
      userInfo: {
        name: userData.name,
        email: userData.email,
        ipAddress: userData.ipAddress,
        userAgent: userData.userAgent,
      },
      status: "waiting",
      lastMessageAt: new Date(),
      metadata: {
        deviceInfo: userData.deviceInfo,
        browser: userData.userAgent,
      },
    });

    await chat.save();
    return chat;
  }

  // Notify admins about new chat
  notifyAdmins(data) {
    this.io.to("admin_room").emit("new_chat_notification", data);
  }

  // Send system message to chat
  async sendSystemMessage(sessionId, message) {
    const chat = await Chat.findOne({ sessionId });
    if (chat) {
      const systemMessage = {
        messageId: `SYS-${Date.now()}`,
        text: message,
        sender: "system",
        type: "system",
        timestamp: new Date(),
      };

      chat.messages.push(systemMessage);
      await chat.save();

      this.io.to(`chat_${sessionId}`).emit("system_message", { message });
    }
  }
}

module.exports = ChatSocket;
