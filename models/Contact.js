const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  jobTitle: {
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
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social', 'event', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  lastContacted: {
    type: Date
  },
  isFavorite: {
    type: Boolean,
    default: false
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

// Indexes for faster queries
contactSchema.index({ userId: 1, lastName: 1 });
contactSchema.index({ userId: 1, company: 1 });
contactSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);