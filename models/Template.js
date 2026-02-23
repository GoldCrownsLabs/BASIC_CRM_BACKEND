const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["email", "whatsapp", "both"],
      required: true,
    },
    subject: {
      type: String,
      required: function () {
        return this.type === "email" || this.type === "both";
      },
    },
    content: {
      type: String,
      required: true,
    },
    variables: [
      {
        type: String,
        enum: ["name", "email", "phone", "company", "position", "custom"],
      },
    ],
    customVariables: [
      {
        key: String,
        label: String,
        defaultValue: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Template", templateSchema);
