const mongoose = require("mongoose");

/* =========================
   Message Schema
========================= */
const chatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    unique: true,
  },
  text: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    enum: ["user", "support", "bot", "admin", "system"],
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  senderName: String,
  senderAvatar: String,

  status: {
    type: String,
    enum: ["sending", "sent", "delivered", "read", "failed"],
    default: "sent",
  },

  type: {
    type: String,
    enum: ["text", "image", "file", "system"],
    default: "text",
  },

  attachments: [
    {
      filename: String,
      url: String,
      type: String,
      size: Number,
    },
  ],

  isDeleted: {
    type: Boolean,
    default: false,
  },

  deletedFor: [String],
  editedAt: Date,

  replyTo: {
    messageId: String,
    text: String,
    sender: String,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },

  readAt: Date,
  deliveredAt: Date,
});

/* =========================
   Chat Session Schema
========================= */
const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      unique: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    userInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: String,
      ipAddress: String,
      userAgent: String,
      avatar: String,
    },

    status: {
      type: String,
      enum: ["active", "waiting", "resolved", "closed", "transferred"],
      default: "waiting",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    assignedToName: String,

    messages: {
      type: [chatMessageSchema],
      default: [],
    },

    unreadCount: {
      type: Number,
      default: 0,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    lastMessage: {
      type: String,
      default: "",
    },

    lastMessageSender: {
      type: String,
      default: "",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: Date,
    resolvedAt: Date,
    transferredAt: Date,
    transferredFrom: String,

    metadata: {
      page: String,
      referrer: String,
      deviceInfo: {
        type: Object,
        default: {},
      },
      browser: String,
      os: String,
    },

    rating: {
      score: { type: Number, min: 1, max: 5 },
      comment: String,
      givenAt: Date,
    },

    tags: {
      type: [String],
      default: [],
    },

    notes: [
      {
        text: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

/* =========================
   PRE-SAVE HOOK (FIXED)
========================= */
chatSessionSchema.pre("save", async function () {
  console.log("🔍 Pre-save hook triggered");

  // ✅ Generate sessionId
  if (!this.sessionId) {
    const now = new Date();

    const formattedDate =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");

    const formattedTime =
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");

    this.sessionId = `CHAT-${formattedDate}-${formattedTime}-${random}`;

    console.log("✅ Generated sessionId:", this.sessionId);
  }

  // ✅ Generate messageId for all messages
  if (this.messages && this.messages.length > 0) {
    this.messages.forEach((msg) => {
      if (!msg.messageId) {
        msg.messageId = `MSG-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}`;
      }
    });
  }
});

/* =========================
   INDEXES (ONLY HERE)
========================= */
chatSessionSchema.index({ sessionId: 1 }, { unique: true });
chatSessionSchema.index({ userId: 1 });
chatSessionSchema.index({ status: 1 });
chatSessionSchema.index({ assignedTo: 1 });
chatSessionSchema.index({ lastMessageAt: -1 });
chatSessionSchema.index({ "userInfo.email": 1 });
chatSessionSchema.index({ createdAt: -1 });

/* =========================
   MODEL EXPORT
========================= */
const Chat = mongoose.model("Chat", chatSessionSchema);
module.exports = Chat;
