const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  firstName: {
    type: String,
    required: [true, 'Please add first name'],
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    default: 'new'
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social', 'event', 'cold_call', 'other'],
    default: 'other'
  },
  value: {
    type: Number,
    min: 0
  },
  expectedCloseDate: {
    type: Date
  },
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'error'],
    default: 'synced'
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ userId: 1, expectedCloseDate: 1 });
leadSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);