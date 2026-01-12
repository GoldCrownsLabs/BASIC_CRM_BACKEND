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
    
    // User Settings
    role: {
      type: String,
      enum: ['user', 'admin'],
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

module.exports = mongoose.model('User', userSchema);