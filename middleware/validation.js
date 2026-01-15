const { validationResult } = require("express-validator");

const contactValidation = [
];

const updateValidation = [
];

// Custom validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
      message: "Validation failed",
    });
  }
  next();
};

module.exports = {
  contactValidation,
  updateValidation,
  validate,
};
