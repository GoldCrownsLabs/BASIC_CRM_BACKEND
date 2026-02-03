const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  country: { type: String, default: 'India' },
  zipCode: String,
  isDefault: { type: Boolean, default: false },
  addressType: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  }
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
    },
    phone: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
    
    // ✅ Address as Array (Multiple addresses support)
    addresses: [addressSchema],
    
    // Keep old shippingAddress for backward compatibility
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'India' },
      zipCode: String,
      isDefault: { type: Boolean, default: false }
    },
    
    // E-commerce Specific
    wishlist: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    cart: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1
      }
    }],
    
    // ✅ NOTIFICATION FIELDS ADDED HERE
    pushToken: {
      type: String,
      default: null,
    },
    notificationSettings: {
      taskNotifications: { type: Boolean, default: true },
      leadNotifications: { type: Boolean, default: true },
      projectNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      inAppNotifications: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      vibrationEnabled: { type: Boolean, default: true },
    },
    lastNotificationCheck: {
      type: Date,
      default: Date.now,
    },
    notificationBadgeCount: {
      type: Number,
      default: 0,
    },
    
    // User Settings
    role: {
      type: String,
      enum: ['user', 'admin', 'manager', 'supervisor'], // ✅ Updated roles
      default: 'user',
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    newsletterSubscription: {
      type: Boolean,
      default: true
    },
    
    // Timestamps
    lastLogin: {
      type: Date,
      default: Date.now
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
    
    // ✅ Additional fields for notifications
    department: {
      type: String,
      enum: ['sales', 'marketing', 'support', 'development', 'management', 'other'],
      default: 'other'
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    teamMembers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
  },
  { timestamps: true }
);

// 🔑 Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 🔐 Manual password hashing in controller
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// ✅ Get managers/admins for notifications
userSchema.statics.getManagersAndAdmins = async function () {
  return await this.find({ 
    role: { $in: ['admin', 'manager', 'supervisor'] },
    isActive: true 
  }).select('_id name email pushToken notificationSettings');
};

// ✅ Get team members for user
userSchema.methods.getTeamMembers = async function () {
  if (this.teamMembers && this.teamMembers.length > 0) {
    return await this.model('User').find({
      _id: { $in: this.teamMembers },
      isActive: true
    }).select('_id name email pushToken notificationSettings');
  }
  return [];
};

// ✅ Get reporting chain
userSchema.methods.getReportingChain = async function () {
  const chain = [];
  let currentUser = this;
  
  while (currentUser.reportingTo) {
    const manager = await this.model('User').findById(currentUser.reportingTo);
    if (manager && manager.isActive) {
      chain.push(manager);
      currentUser = manager;
    } else {
      break;
    }
  }
  
  return chain;
};

// ✅ Check if user should receive notification
userSchema.methods.shouldReceiveNotification = function (type) {
  if (!this.notificationSettings) return true;
  
  switch (type) {
    case 'task':
      return this.notificationSettings.taskNotifications;
    case 'lead':
      return this.notificationSettings.leadNotifications;
    case 'project':
      return this.notificationSettings.projectNotifications;
    case 'push':
      return this.notificationSettings.pushNotifications;
    default:
      return true;
  }
};

module.exports = mongoose.model('User', userSchema);