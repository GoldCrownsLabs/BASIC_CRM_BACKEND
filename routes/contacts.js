const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Contact = require('../models/Contact');

// @route   GET /api/contacts
// @desc    Get all contacts for user
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sort = '-createdAt',
      company,
      tag
    } = req.query;

    // Build query
    let query = { userId: req.user.id };

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by company
    if (company) {
      query.company = company;
    }

    // Filter by tag
    if (tag) {
      query.tags = tag;
    }

    // Execute query with pagination
    const contacts = await Contact.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Contact.countDocuments(query);

    res.json({
      success: true,
      data: contacts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/contacts/:id
// @desc    Get single contact
router.get('/:id', protect, async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/contacts
// @desc    Create new contact
router.post(
  '/',
  protect,
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('email', 'Please include a valid email').optional().isEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const contactData = {
        ...req.body,
        userId: req.user.id
      };

      const contact = new Contact(contactData);
      await contact.save();

      res.status(201).json({ success: true, data: contact });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// @route   PUT /api/contacts/:id
// @desc    Update contact
router.put('/:id', protect, async (req, res) => {
  try {
    let contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Update contact
    Object.assign(contact, req.body, { lastModified: Date.now() });
    await contact.save();

    res.json({ success: true, data: contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/contacts/:id
// @desc    Delete contact
router.delete('/:id', protect, async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/contacts/stats/count
// @desc    Get contact counts
router.get('/stats/count', protect, async (req, res) => {
  try {
    const total = await Contact.countDocuments({ userId: req.user.id });
    const recent = await Contact.countDocuments({
      userId: req.user.id,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    res.json({
      success: true,
      data: { total, recent }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/contacts/batch
// @desc    Sync multiple contacts (for offline sync)
router.post('/batch', protect, async (req, res) => {
  try {
    const { contacts, lastSync } = req.body;
    const results = {
      created: [],
      updated: [],
      errors: []
    };

    for (const contactData of contacts) {
      try {
        if (contactData._id) {
          // Update existing contact
          const contact = await Contact.findOne({
            _id: contactData._id,
            userId: req.user.id
          });

          if (contact) {
            Object.assign(contact, contactData, { lastModified: Date.now() });
            await contact.save();
            results.updated.push(contact);
          } else {
            // Create new contact
            const newContact = new Contact({
              ...contactData,
              userId: req.user.id,
              _id: contactData._id
            });
            await newContact.save();
            results.created.push(newContact);
          }
        } else {
          // Create new contact
          const newContact = new Contact({
            ...contactData,
            userId: req.user.id
          });
          await newContact.save();
          results.created.push(newContact);
        }
      } catch (error) {
        results.errors.push({
          contact: contactData,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;