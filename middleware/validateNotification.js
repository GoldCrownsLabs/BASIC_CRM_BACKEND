// middleware/validateNotification.js
const mongoose = require("mongoose");

const validateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid notification ID format",
      });
    }

    next();
  } catch (error) {
    console.error("Validation middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Validation error",
    });
  }
};

module.exports = validateNotification;
