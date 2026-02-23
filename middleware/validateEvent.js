const Joi = require("joi");

// Event validation schema
const eventSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    "string.empty": "Event title is required",
    "string.min": "Event title must be at least 3 characters long",
    "string.max": "Event title cannot exceed 200 characters",
    "any.required": "Event title is required",
  }),

  description: Joi.string().max(1000).allow("", null).messages({
    "string.max": "Description cannot exceed 1000 characters",
  }),

  type: Joi.string()
    .valid(
      "meeting",
      "call",
      "email",
      "task",
      "deadline",
      "reminder",
      "appointment",
      "other",
    )
    .default("meeting")
    .messages({
      "any.only":
        "Event type must be one of: meeting, call, email, task, deadline, reminder, appointment, other",
    }),

  date: Joi.date().required().messages({
    "date.base": "Valid date is required",
    "any.required": "Event date is required",
  }),

  startTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      "string.pattern.base": "Start time must be in 24-hour format (HH:MM)",
      "any.required": "Start time is required",
    }),

  endTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "End time must be in 24-hour format (HH:MM)",
    }),

  duration: Joi.number().integer().min(5).max(1440).default(60).messages({
    "number.base": "Duration must be a number",
    "number.min": "Duration must be at least 5 minutes",
    "number.max": "Duration cannot exceed 1440 minutes (24 hours)",
  }),

  contactName: Joi.string().max(100).allow("", null).messages({
    "string.max": "Contact name cannot exceed 100 characters",
  }),

  contactId: Joi.string().hex().length(24).allow("", null).messages({
    "string.hex": "Contact ID must be a valid MongoDB ObjectId",
    "string.length": "Contact ID must be 24 characters",
  }),

  company: Joi.string().max(100).allow("", null).messages({
    "string.max": "Company name cannot exceed 100 characters",
  }),

  location: Joi.string().max(200).allow("", null).messages({
    "string.max": "Location cannot exceed 200 characters",
  }),

  status: Joi.string()
    .valid("scheduled", "completed", "cancelled", "postponed", "in-progress")
    .default("scheduled")
    .messages({
      "any.only":
        "Status must be one of: scheduled, completed, cancelled, postponed, in-progress",
    }),

  priority: Joi.string()
    .valid("low", "medium", "high", "urgent")
    .default("medium")
    .messages({
      "any.only": "Priority must be one of: low, medium, high, urgent",
    }),

  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .default("#3B82F6")
    .messages({
      "string.pattern.base": "Color must be a valid hex color code (#RRGGBB)",
    }),

  isAllDay: Joi.boolean().default(false),

  isRecurring: Joi.boolean().default(false),

  recurringPattern: Joi.string()
    .valid("daily", "weekly", "monthly", "yearly", "custom")
    .when("isRecurring", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "any.only":
        "Recurring pattern must be one of: daily, weekly, monthly, yearly, custom",
      "any.required": "Recurring pattern is required when isRecurring is true",
    }),

  recurringEndDate: Joi.date()
    .when("isRecurring", {
      is: true,
      then: Joi.date().greater(Joi.ref("date")).required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "date.greater": "Recurring end date must be after the start date",
      "any.required": "Recurring end date is required when isRecurring is true",
    }),

  reminders: Joi.array()
    .items(Joi.number().integer().min(1).max(10080))
    .default([15, 30, 60])
    .messages({
      "array.base": "Reminders must be an array",
      "number.base": "Reminder minutes must be a number",
      "number.min": "Reminder minutes must be at least 1",
      "number.max": "Reminder minutes cannot exceed 10080 (7 days)",
    }),

  tags: Joi.array().items(Joi.string().max(50)).default([]).messages({
    "array.base": "Tags must be an array",
    "string.max": "Tag cannot exceed 50 characters",
  }),

  attachments: Joi.array()
    .items(
      Joi.object({
        filename: Joi.string().required(),
        url: Joi.string().uri().required(),
        uploadedAt: Joi.date().default(() => new Date()),
      }),
    )
    .default([])
    .messages({
      "array.base": "Attachments must be an array",
      "string.uri": "Attachment URL must be a valid URI",
    }),

  notes: Joi.array()
    .items(
      Joi.object({
        content: Joi.string().required(),
        createdBy: Joi.string().hex().length(24),
        createdAt: Joi.date().default(() => new Date()),
      }),
    )
    .default([]),
});

// Quick add event validation schema
const quickAddEventSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    "string.empty": "Event title is required",
    "any.required": "Event title is required",
  }),

  date: Joi.date().required().messages({
    "date.base": "Valid date is required",
    "any.required": "Event date is required",
  }),

  time: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      "string.pattern.base": "Time must be in 24-hour format (HH:MM)",
      "any.required": "Time is required",
    }),

  type: Joi.string()
    .valid(
      "meeting",
      "call",
      "email",
      "task",
      "deadline",
      "reminder",
      "appointment",
      "other",
    )
    .default("task")
    .messages({
      "any.only":
        "Event type must be one of: meeting, call, email, task, deadline, reminder, appointment, other",
    }),

  priority: Joi.string()
    .valid("low", "medium", "high", "urgent")
    .default("medium")
    .messages({
      "any.only": "Priority must be one of: low, medium, high, urgent",
    }),
});

// Event status update validation schema
const eventStatusSchema = Joi.object({
  status: Joi.string()
    .valid("scheduled", "completed", "cancelled", "postponed", "in-progress")
    .required()
    .messages({
      "any.only":
        "Status must be one of: scheduled, completed, cancelled, postponed, in-progress",
      "any.required": "Status is required",
    }),
});

// Bulk update validation schema
const bulkUpdateSchema = Joi.object({
  eventIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required()
    .messages({
      "array.base": "Event IDs must be an array",
      "array.min": "At least one event ID is required",
      "any.required": "Event IDs are required",
      "string.hex": "Event ID must be a valid MongoDB ObjectId",
      "string.length": "Event ID must be 24 characters",
    }),

  updates: Joi.object().min(1).required().messages({
    "object.base": "Updates must be an object",
    "object.min": "At least one update field is required",
    "any.required": "Updates are required",
  }),
});

// Export validation middleware functions
const validateEvent = (req, res, next) => {
  const { error, value } = eventSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message.replace(/['"]+/g, ""),
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Set validated data
  req.validatedData = value;
  next();
};

const validateQuickAddEvent = (req, res, next) => {
  const { error, value } = quickAddEventSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message.replace(/['"]+/g, ""),
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.validatedData = value;
  next();
};

const validateEventStatus = (req, res, next) => {
  const { error, value } = eventStatusSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message.replace(/['"]+/g, ""),
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.validatedData = value;
  next();
};

const validateBulkUpdate = (req, res, next) => {
  const { error, value } = bulkUpdateSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message.replace(/['"]+/g, ""),
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.validatedData = value;
  next();
};

// Export as object
module.exports = {
  validateEvent,
  validateQuickAddEvent,
  validateEventStatus,
  validateBulkUpdate,
};
