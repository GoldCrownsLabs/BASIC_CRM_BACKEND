const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Lead = require('../models/Lead');

// @route   GET /api/leads
// @desc    Get all leads for user
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status,
      sort = '-createdAt'
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

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Execute query with pagination
    const leads = await Lead.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Lead.countDocuments(query);

    res.json({
      success: true,
      data: leads,
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

// @route   GET /api/leads/stats
// @desc    Get lead statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const pipeline = [
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$value' }
        }
      }
    ];

    const stats = await Lead.aggregate(pipeline);
    
    // Calculate totals
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalValue = stats.reduce((sum, stat) => sum + (stat.totalValue || 0), 0);

    res.json({
      success: true,
      data: {
        stats,
        total,
        totalValue
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/leads/upcoming
// @desc    Get upcoming leads (closing soon)
router.get('/upcoming', protect, async (req, res) => {
  try {
    const leads = await Lead.find({
      userId: req.user.id,
      expectedCloseDate: { $gte: new Date() },
      status: { $in: ['contacted', 'qualified', 'proposal', 'negotiation'] }
    })
    .sort('expectedCloseDate')
    .limit(10);

    res.json({ success: true, data: leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add other CRUD routes similar to contacts...

module.exports = router;