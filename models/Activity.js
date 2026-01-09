const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  type: {
    type: String,
    enum: ['call', 'meeting', 'email', 'note', 'task', 'other'],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  duration: {
    type: Number, // in minutes
    min: 0
  },
  outcome: {
    type: String,
    trim: true
  },
  followUpDate: {
    type: Date
  },
  isCompleted: {
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

// Indexes
activitySchema.index({ userId: 1, date: -1 });
activitySchema.index({ userId: 1, contactId: 1 });
activitySchema.index({ userId: 1, leadId: 1 });

module.exports = mongoose.model('Activity', activitySchema);