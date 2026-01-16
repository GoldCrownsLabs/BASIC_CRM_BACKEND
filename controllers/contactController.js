const Contact = require("../models/Contact");

// ===============================
// @desc    Get all contacts with pagination and filters
// @route   GET /api/contacts
// @access  Private
// ===============================
const getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      sort = "-createdAt",
      company,
      tag,
      isFavorite,
      source,
    } = req.query;

    // Validate and sanitize inputs
    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 100);

    // Validate sort field
    const allowedSortFields = [
      "firstName",
      "lastName",
      "email",
      "company",
      "createdAt",
      "lastModified",
    ];
    let sortField = sort.replace(/^-/, "");
    let sortOrder = sort.startsWith("-") ? -1 : 1;

    if (!allowedSortFields.includes(sortField)) {
      sortField = "createdAt";
      sortOrder = -1;
    }

    // Build query
    let query = {
      userId: req.user.id,
      isDeleted: false,
    };

    // Search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
        { tags: searchRegex },
      ];
    }

    // Filter by company
    if (company && company.trim()) {
      query.company = new RegExp(`^${company}$`, "i");
    }

    // Filter by tag
    if (tag && tag.trim()) {
      query.tags = tag;
    }

    // Filter by favorite
    if (isFavorite !== undefined) {
      query.isFavorite = isFavorite === "true" || isFavorite === true;
    }

    // Filter by source
    if (source && source.trim()) {
      query.source = source;
    }

    // Execute query with pagination
    const contacts = await Contact.find(query)
      .sort({ [sortField]: sortOrder })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .select("-__v");

    // Get total count for pagination
    const total = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching contacts",
    });
  }
};

// ===============================
// @desc    Get single contact by ID
// @route   GET /api/contacts/:id
// @access  Private
// ===============================
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    }).select("-__v");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error("Get contact by ID error:", error);

    // Check for invalid ID format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while fetching contact",
    });
  }
};

// ===============================
// @desc    Create new contact
// @route   POST /api/contacts
// @access  Private
// ===============================
const createContact = async (req, res, next) => {
  try {
    // req.user comes from protect middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      tags,
      notes,
      address,
      source,
      lastContacted,
      isFavorite = false,
    } = req.body;

    // Required field check
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required",
      });
    }

    // Validate firstName length
    if (firstName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "First name must be at least 2 characters",
      });
    }

    // Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please include a valid email",
        });
      }
    }

    // Duplicate email check
    if (email && email.trim()) {
      const exists = await Contact.findOne({
        userId: req.user.id,
        email: email.toLowerCase(),
        isDeleted: false,
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Contact with this email already exists",
        });
      }
    }

    // Prepare contact data
    const contactData = {
      userId: req.user.id,
      firstName: firstName.trim(),
      lastName: (lastName || "").trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: (phone || "").trim(),
      company: (company || "").trim(),
      jobTitle: (jobTitle || "").trim(),
      notes: (notes || "").trim(),
      source: source || "other",
      lastContacted: lastContacted || null,
      isFavorite: isFavorite,
    };

    // Process tags if provided
    if (tags) {
      if (Array.isArray(tags)) {
        contactData.tags = tags
          .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag)))
          .filter((tag) => tag);
      } else if (typeof tags === "string") {
        contactData.tags = [tags.trim()].filter((tag) => tag);
      }
    }

    // Process address if provided
    if (address && typeof address === "object") {
      contactData.address = {};
      if (address.street) contactData.address.street = address.street.trim();
      if (address.city) contactData.address.city = address.city.trim();
      if (address.state) contactData.address.state = address.state.trim();
      if (address.country) contactData.address.country = address.country.trim();
      if (address.zipCode) contactData.address.zipCode = address.zipCode.trim();

      // Remove if all address fields are empty
      if (Object.keys(contactData.address).length === 0) {
        delete contactData.address;
      }
    }

    const contact = await Contact.create(contactData);

    // Remove version key from response
    const contactResponse = contact.toObject();
    delete contactResponse.__v;

    res.status(201).json({
      success: true,
      data: contactResponse,
      message: "Contact created successfully",
    });
  } catch (error) {
    console.error("Create contact error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists for another contact",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating contact",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ===============================
// @desc    Update contact
// @route   PUT /api/contacts/:id
// @access  Private
// ===============================
const updateContact = async (req, res) => {
  try {
    // Allowed fields for update
    const allowedUpdates = [
      "firstName",
      "lastName",
      "company",
      "jobTitle",
      "email",
      "phone",
      "address",
      "tags",
      "notes",
      "lastContacted",
      "isFavorite",
      "source",
    ];

    // Filter only allowed fields
    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (typeof req.body[key] === "string") {
          updates[key] = req.body[key].trim();
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    // Check for duplicate email if updating email
    if (updates.email && updates.email.trim()) {
      updates.email = updates.email.toLowerCase();

      const existingContact = await Contact.findOne({
        _id: { $ne: req.params.id },
        userId: req.user.id,
        email: updates.email,
        isDeleted: false,
      });

      if (existingContact) {
        return res.status(400).json({
          success: false,
          message: "Another contact with this email already exists",
        });
      }
    }

    // Update contact
    const contact = await Contact.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        isDeleted: false,
      },
      {
        ...updates,
        lastModified: Date.now(),
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-__v");

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
      message: "Contact updated successfully",
    });
  } catch (error) {
    console.error("Update contact error:", error);

    // Check for invalid ID format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating contact",
    });
  }
};

// ===============================
// @desc    Toggle favorite status
// @route   PATCH /api/contacts/:id/favorite
// @access  Private
// ===============================
const toggleFavorite = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Toggle favorite status
    contact.isFavorite = !contact.isFavorite;
    contact.lastModified = Date.now();
    await contact.save();

    // Remove version key from response
    const contactResponse = contact.toObject();
    delete contactResponse.__v;

    res.status(200).json({
      success: true,
      data: contactResponse,
      message: `Contact ${
        contact.isFavorite ? "added to" : "removed from"
      } favorites`,
    });
  } catch (error) {
    console.error("Toggle favorite error:", error);

    // Check for invalid ID format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating favorite status",
    });
  }
};

// ===============================
// @desc    Soft delete contact
// @route   DELETE /api/contacts/:id
// @access  Private
// ===============================
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        lastModified: Date.now(),
      },
      {
        new: true,
      }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
      data: { id: contact._id },
    });
  } catch (error) {
    console.error("Delete contact error:", error);

    // Check for invalid ID format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while deleting contact",
    });
  }
};

// ===============================
// @desc    Get contact statistics
// @route   GET /api/contacts/stats/count
// @access  Private
// ===============================
const getContactStats = async (req, res) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, recent, favorites, bySource] = await Promise.all([
      Contact.countDocuments({
        userId: req.user.id,
        isDeleted: false,
      }),
      Contact.countDocuments({
        userId: req.user.id,
        createdAt: { $gte: oneWeekAgo },
        isDeleted: false,
      }),
      Contact.countDocuments({
        userId: req.user.id,
        isFavorite: true,
        isDeleted: false,
      }),
      Contact.aggregate([
        {
          $match: {
            userId: req.user.id,
            isDeleted: false,
            source: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$source",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            source: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    const recentMonth = await Contact.countDocuments({
      userId: req.user.id,
      createdAt: { $gte: oneMonthAgo },
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        recentWeek: recent,
        recentMonth,
        favorites,
        bySource,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching statistics",
    });
  }
};

// ===============================
// @desc    Get tag statistics
// @route   GET /api/contacts/stats/tags
// @access  Private
// ===============================
const getTagStats = async (req, res) => {
  try {
    const tagStats = await Contact.aggregate([
      {
        $match: {
          userId: req.user.id,
          isDeleted: false,
          tags: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          tag: "$_id",
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.status(200).json({
      success: true,
      data: tagStats,
    });
  } catch (error) {
    console.error("Get tag stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching tag statistics",
    });
  }
};

// ===============================
// @desc    Batch sync contacts
// @route   POST /api/contacts/batch
// @access  Private
// ===============================
const batchSyncContacts = async (req, res) => {
  try {
    const { contacts = [] } = req.body;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        message: "Contacts must be an array",
      });
    }

    if (contacts.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Cannot process more than 100 contacts at once",
      });
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    // Process contacts sequentially
    for (const contactData of contacts) {
      try {
        // Validate required fields
        if (!contactData.firstName || !contactData.firstName.trim()) {
          throw new Error("First name is required");
        }

        // Normalize and trim data
        const processedData = { ...contactData };
        Object.keys(processedData).forEach((key) => {
          if (typeof processedData[key] === "string") {
            processedData[key] = processedData[key].trim();
          }
        });

        // Normalize email
        if (processedData.email) {
          processedData.email = processedData.email.toLowerCase();

          // Check for duplicate email
          const existingContact = await Contact.findOne({
            userId: req.user.id,
            email: processedData.email,
            isDeleted: false,
            _id: { $ne: processedData._id },
          });

          if (existingContact) {
            throw new Error(
              `Email ${processedData.email} already exists in another contact`
            );
          }
        }

        if (processedData._id) {
          // Update existing contact
          const contact = await Contact.findOneAndUpdate(
            {
              _id: processedData._id,
              userId: req.user.id,
            },
            {
              ...processedData,
              userId: req.user.id,
              lastModified: Date.now(),
              isDeleted: false,
            },
            {
              new: true,
              runValidators: true,
              upsert: false,
            }
          );

          if (contact) {
            results.updated.push(contact._id.toString());
          } else {
            // If contact not found with this ID, create new
            delete processedData._id;
            const newContact = new Contact({
              ...processedData,
              userId: req.user.id,
            });
            await newContact.save();
            results.created.push(newContact._id.toString());
          }
        } else {
          // Create new contact
          const newContact = new Contact({
            ...processedData,
            userId: req.user.id,
          });
          await newContact.save();
          results.created.push(newContact._id.toString());
        }
      } catch (error) {
        results.errors.push({
          contact:
            contactData.email || contactData.firstName || "Unknown contact",
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...results,
        summary: {
          totalProcessed: contacts.length,
          successful: results.created.length + results.updated.length,
          failed: results.errors.length,
        },
      },
      message: `Batch processed: ${results.created.length} created, ${results.updated.length} updated, ${results.errors.length} failed`,
    });
  } catch (error) {
    console.error("Batch processing error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing batch contacts",
    });
  }
};

// ===============================
// EXPORTS
// ===============================
module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  toggleFavorite,
  deleteContact,
  getContactStats,
  getTagStats,
  batchSyncContacts,
};
