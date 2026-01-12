// const express = require("express");
// const router = express.Router();
// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcryptjs");
// const User = require("../models/User");

// // ========================
// // MIDDLEWARE
// // ========================
// // Protect middleware - JWT verification
// const protect = async (req, res, next) => {
//   let token;

//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     try {
//       token = req.headers.authorization.split(" ")[1];
//       const decoded = jwt.verify(
//         token,
//         process.env.JWT_SECRET || "dev_secret_key_for_testing"
//       );
//       req.user = await User.findById(decoded.id).select("-password");
//       next();
//     } catch (error) {
//       return res.status(401).json({
//         success: false,
//         error: "Not authorized, token failed",
//       });
//     }
//   } else {
//     return res.status(401).json({
//       success: false,
//       error: "Not authorized, no token",
//     });
//   }
// };
// // Admin middleware
// const admin = (req, res, next) => {
//   if (req.user && req.user.role === "admin") {
//     next();
//   } else {
//     return res.status(403).json({
//       success: false,
//       error: "Not authorized as admin",
//     });
//   }
// };
// // ========================
// // UTILITY FUNCTIONS
// // ========================
// // JWT Token generate function
// const generateToken = (id) => {
//   return jwt.sign(
//     { id },
//     process.env.JWT_SECRET || "dev_secret_key_for_testing",
//     { expiresIn: "30d" }
//   );
// };
// // ========================
// // AUTH ROUTES
// // ========================
// // @route   POST /api/auth/register
// router.post("/register", async (req, res) => {
//   try {
//     const { name, email, password, role } = req.body;

//     // Basic validation
//     if (!name || !email || !password) {
//       return res.status(400).json({
//         success: false,
//         error: "Please provide all fields: name, email, password",
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         success: false,
//         error: "Password must be at least 6 characters",
//       });
//     }

//     // ✅ Validate role if provided
//     let userRole = "user"; // Default
//     if (role && ["user", "admin"].includes(role)) {
//       userRole = role;
//     }

//     // Check if user exists
//     const userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({
//         success: false,
//         error: "User already exists",
//       });
//     }

//     // Hash password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     // ✅ CORRECTED: Dynamic role use करें
//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       profileImage: "",
//       theme: "light",
//       syncSettings: {
//         autoSync: true,
//         syncInterval: 5,
//       },
//       role: userRole,
//       lastSync: new Date(),
//     });

//     // Get the freshly created user with all fields
//     const newUser = await User.findById(user._id);

//     // Generate token
//     const token = generateToken(newUser._id);

//     // Send COMPLETE user response
//     res.status(201).json({
//       success: true,
//       message: "User registered successfully",
//       token,
//       user: {
//         id: newUser._id,
//         name: newUser.name,
//         email: newUser.email,
//         profileImage: newUser.profileImage,
//         theme: newUser.theme,
//         syncSettings: newUser.syncSettings,
//         role: newUser.role, // ✅ अब "admin" आएगा अगर request में भेजा था
//         lastSync: newUser.lastSync,
//         createdAt: newUser.createdAt,
//         updatedAt: newUser.updatedAt,
//       },
//     });
//   } catch (error) {
//     console.error("Registration Error:", error);

//     // Specific error handling
//     if (error.name === "ValidationError") {
//       const errors = Object.values(error.errors).map((err) => err.message);
//       return res.status(400).json({
//         success: false,
//         error: errors.join(", "),
//       });
//     }

//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         error: "Email already exists",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: "Registration failed. Please try again.",
//     });
//   }
// });
// // @route   POST /api/auth/login
// router.post("/login", async (req, res) => {
//   console.log("🔑 LOGIN REQUEST:", req.body);

//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       console.log("❌ Missing email or password");
//       return res.status(400).json({
//         success: false,
//         error: "Please provide email and password",
//       });
//     }

//     console.log("🔍 Finding user:", email);
//     const user = await User.findOne({ email });

//     if (!user) {
//       console.log("❌ User not found:", email);
//       return res.status(401).json({
//         success: false,
//         error: "Invalid credentials",
//       });
//     }

//     console.log("✅ User found. Role:", user.role);
//     console.log("🔐 Comparing password...");

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       console.log("❌ Password mismatch");
//       return res.status(401).json({
//         success: false,
//         error: "Invalid credentials",
//       });
//     }

//     console.log("✅ Password matched");
//     const token = generateToken(user._id);
//     console.log("✅ Token generated");

//     res.json({
//       success: true,
//       message: "Login successful",
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         profileImage: user.profileImage,
//         theme: user.theme,
//         syncSettings: user.syncSettings,
//         role: user.role,
//         lastSync: user.lastSync,
//         createdAt: user.createdAt,
//         updatedAt: user.updatedAt,
//       },
//     });
//   } catch (error) {
//     console.error("🔥 LOGIN ERROR DETAILS:");
//     console.error("Error Name:", error.name);
//     console.error("Error Message:", error.message);
//     console.error("Error Stack:", error.stack);
//     console.error("Full Error:", JSON.stringify(error, null, 2));

//     res.status(500).json({
//       success: false,
//       error: "Login failed. Please try again.",
//     });
//   }
// });
// // ========================
// // PROFILE ROUTES (PROTECTED)
// // ========================
// // @route   GET /api/auth/profile
// router.get("/profile", protect, async (req, res) => {
//   try {
//     const user = req.user;

//     res.json({
//       success: true,
//       message: "Profile retrieved successfully",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         profileImage: user.profileImage,
//         theme: user.theme,
//         syncSettings: user.syncSettings,
//         role: user.role,
//         lastSync: user.lastSync,
//         createdAt: user.createdAt,
//         updatedAt: user.updatedAt,
//       },
//     });
//   } catch (error) {
//     console.error("Profile Error:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch profile",
//     });
//   }
// });
// // @route   PUT /api/auth/profile
// // Admin and user
// // admin have all users data and user have only own detail.
// // @route   PUT /api/auth/change-password
// router.put("/change-password", protect, async (req, res) => {
//   try {
//     const { currentPassword, newPassword } = req.body;

//     if (!currentPassword || !newPassword) {
//       return res.status(400).json({
//         success: false,
//         error: "Please provide current and new password",
//       });
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         success: false,
//         error: "New password must be at least 6 characters",
//       });
//     }

//     // Get user with password
//     const user = await User.findById(req.user._id).select("+password");

//     // Check current password
//     const isMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isMatch) {
//       return res.status(401).json({
//         success: false,
//         error: "Current password is incorrect",
//       });
//     }

//     // Hash new password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(newPassword, salt);

//     // Update password
//     user.password = hashedPassword;
//     await user.save();

//     res.json({
//       success: true,
//       message: "Password changed successfully",
//     });
//   } catch (error) {
//     console.error("Change Password Error:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to change password",
//     });
//   }
// });
// // @route   DELETE /api/auth/profile
// // @desc    Delete user account
// // @access  Private
// router.delete("/delete-profile", protect, async (req, res) => {
//   try {
//     await User.findByIdAndDelete(req.user._id);

//     res.json({
//       success: true,
//       message: "Your account has been deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete Profile Error:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to delete account",
//     });
//   }
// });
// // ========================
// // ADMIN ROUTES
// // ========================
// // @route   GET /api/auth/users
// // @desc    Get all users (Admin only)
// // @access  Private/Admin
// router.get("/users", protect, admin, async (req, res) => {
//   try {
//     const users = await User.find().select("-password");

//     res.json({
//       success: true,
//       count: users.length,
//       users,
//     });
//   } catch (error) {
//     console.error("Get Users Error:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch users",
//     });
//   }
// });
// // ========================
// // UTILITY ROUTES
// // ========================
// // @route   POST /api/auth/logout
// // @desc    Logout user
// // @access  Private
// router.post("/logout", protect, async (req, res) => {
//   res.json({
//     success: true,
//     message: "Logged out successfully",
//   });
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// ========================
// MIDDLEWARE
// ========================

// Protect middleware - JWT verification
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev_secret_key_for_testing"
      );
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Not authorized, token failed",
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      error: "Not authorized, no token",
    });
  }
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: "Not authorized as admin",
    });
  }
};

// ========================
// UTILITY FUNCTIONS
// ========================

// JWT Token generate function
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || "dev_secret_key_for_testing",
    { expiresIn: "30d" }
  );
};

// ========================
// AUTH ROUTES
// ========================

// @route   POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, addresses } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide all fields: name, email, password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    // ✅ Validate role if provided
    let userRole = "user"; // Default
    if (role && ["user", "admin"].includes(role)) {
      userRole = role;
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: "User already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Validate and prepare addresses
    let userAddresses = [];
    if (addresses && Array.isArray(addresses)) {
      // Ensure only one default address
      let hasDefault = false;
      userAddresses = addresses.map((addr, index) => {
        const address = {
          street: addr.street || "",
          city: addr.city || "",
          state: addr.state || "",
          country: addr.country || "India",
          zipCode: addr.zipCode || "",
          addressType: addr.addressType || (index === 0 ? "home" : "other"),
          isDefault: addr.isDefault || false,
        };

        if (address.isDefault) hasDefault = true;
        return address;
      });

      // If no default address, make first one default
      if (userAddresses.length > 0 && !hasDefault) {
        userAddresses[0].isDefault = true;
      }
    }

    // ✅ Create user with addresses
    const userData = {
      name,
      email,
      password: hashedPassword,
      phone: phone || "",
      profileImage: "",
      theme: "light",
      role: userRole,
      addresses: userAddresses,
      lastSync: new Date(),
      lastLogin: new Date(),
      emailVerified: false,
      isActive: true,
      newsletterSubscription: true,
    };

    const user = await User.create(userData);

    // Get the freshly created user with all fields
    const newUser = await User.findById(user._id);

    // Generate token
    const token = generateToken(newUser._id);

    // Send COMPLETE user response
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        profileImage: newUser.profileImage,
        theme: newUser.theme,
        addresses: newUser.addresses,
        role: newUser.role,
        lastSync: newUser.lastSync,
        lastLogin: newUser.lastLogin,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error);

    // Specific error handling
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      error: "Registration failed. Please try again.",
    });
  }
});

// @route   POST /api/auth/login
router.post("/login", async (req, res) => {
  console.log("🔑 LOGIN REQUEST:", req.body);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({
        success: false,
        error: "Please provide email and password",
      });
    }

    console.log("🔍 Finding user:", email);
    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    console.log("✅ User found. Role:", user.role);
    console.log("🔐 Comparing password...");

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Password mismatch");
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    console.log("✅ Password matched");

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    console.log("✅ Token generated");

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        theme: user.theme,
        addresses: user.addresses,
        role: user.role,
        lastSync: user.lastSync,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("🔥 LOGIN ERROR DETAILS:");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);

    res.status(500).json({
      success: false,
      error: "Login failed. Please try again.",
    });
  }
});

// ========================
// PROFILE ROUTES (PROTECTED)
// ========================

// @route   GET /api/auth/profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile retrieved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        theme: user.theme,
        addresses: user.addresses,
        role: user.role,
        lastSync: user.lastSync,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Profile Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, phone, profileImage, theme, newsletterSubscription } =
      req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (theme !== undefined) updateData.theme = theme;
    if (newsletterSubscription !== undefined)
      updateData.newsletterSubscription = newsletterSubscription;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile Update Error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
});

// @route   PUT /api/auth/change-password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Please provide current and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters",
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password",
    });
  }
});

// @route   DELETE /api/auth/profile
// @desc    Delete user account
// @access  Private
router.delete("/delete-profile", protect, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Your account has been deleted successfully",
    });
  } catch (error) {
    console.error("Delete Profile Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete account",
    });
  }
});

// ========================
// ADDRESS MANAGEMENT ROUTES
// ========================

// @route   GET /api/auth/addresses
// @desc    Get all addresses of user
// @access  Private
router.get("/addresses", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      count: user.addresses.length,
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Get Addresses Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch addresses",
    });
  }
});

// @route   POST /api/auth/addresses
// @desc    Add new address
// @access  Private
router.post("/addresses", protect, async (req, res) => {
  try {
    const { street, city, state, country, zipCode, addressType, isDefault } =
      req.body;

    // Basic validation
    if (!street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        error: "Please provide street, city, state and zip code",
      });
    }

    const newAddress = {
      street,
      city,
      state,
      country: country || "India",
      zipCode,
      addressType: addressType || "home",
      isDefault: isDefault || false,
    };

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // If this address is default, remove default from others
    if (newAddress.isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    // If it's first address, make it default
    if (user.addresses.length === 0) {
      newAddress.isDefault = true;
    }

    user.addresses.push(newAddress);
    await user.save();

    // Get updated user
    const updatedUser = await User.findById(req.user._id).select("addresses");

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: updatedUser.addresses,
    });
  } catch (error) {
    console.error("Add Address Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add address",
    });
  }
});

// @route   PUT /api/auth/addresses/:addressId
// @desc    Update specific address
// @access  Private
router.put("/addresses/:addressId", protect, async (req, res) => {
  try {
    const { addressId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Find address index
    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Address not found",
      });
    }

    // If setting as default, remove default from others
    if (updateData.isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    // Update address
    user.addresses[addressIndex] = {
      ...user.addresses[addressIndex].toObject(),
      ...updateData,
    };

    await user.save();

    // Get updated user
    const updatedUser = await User.findById(req.user._id).select("addresses");

    res.json({
      success: true,
      message: "Address updated successfully",
      addresses: updatedUser.addresses,
    });
  } catch (error) {
    console.error("Update Address Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update address",
    });
  }
});

// @route   DELETE /api/auth/addresses/:addressId
// @desc    Delete address
// @access  Private
router.delete("/addresses/:addressId", protect, async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Find address
    const address = user.addresses.find(
      (addr) => addr._id.toString() === addressId
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        error: "Address not found",
      });
    }

    // Check if it's the last address
    if (user.addresses.length === 1) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete the last address. Add another address first.",
      });
    }

    // Remove address
    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== addressId
    );

    // If deleted address was default, make first address default
    if (address.isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    // Get updated user
    const updatedUser = await User.findById(req.user._id).select("addresses");

    res.json({
      success: true,
      message: "Address deleted successfully",
      addresses: updatedUser.addresses,
    });
  } catch (error) {
    console.error("Delete Address Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete address",
    });
  }
});

// @route   PUT /api/auth/addresses/:addressId/set-default
// @desc    Set address as default
// @access  Private
router.put("/addresses/:addressId/set-default", protect, async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Remove default from all addresses
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });

    // Find and set new default
    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Address not found",
      });
    }

    user.addresses[addressIndex].isDefault = true;
    await user.save();

    // Get updated user
    const updatedUser = await User.findById(req.user._id).select("addresses");

    res.json({
      success: true,
      message: "Default address updated successfully",
      addresses: updatedUser.addresses,
    });
  } catch (error) {
    console.error("Set Default Address Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to set default address",
    });
  }
});

// ========================
// ADMIN ROUTES
// ========================

// @route   GET /api/auth/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get("/users", protect, admin, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
    });
  }
});

// @route   GET /api/auth/users/:id
// @desc    Get user by ID (Admin only)
// @access  Private/Admin
router.get("/users/:id", protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get User by ID Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user",
    });
  }
});

// @route   PUT /api/auth/users/:userId
// @desc    Update any user profile (Admin only)
// @access  Private/Admin
router.put("/users/:userId", protect, admin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this route
    delete updateData.password;
    delete updateData.email;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Admin Update User Error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update user",
    });
  }
});

// @route   DELETE /api/auth/users/:userId
// @desc    Delete user (Admin only)
// @access  Private/Admin
router.delete("/users/:userId", protect, admin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: "You cannot delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user",
    });
  }
});

// ========================
// UTILITY ROUTES
// ========================

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", protect, async (req, res) => {
  // For JWT, we don't need to do anything server-side
  // Client should remove the token
  res.json({
    success: true,
    message: "Logged out successfully. Please remove the token from client.",
  });
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post("/refresh-token", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Refresh Token Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh token",
    });
  }
});

// @route   GET /api/auth/check-admin
// @desc    Check if user is admin
// @access  Private
router.get("/check-admin", protect, (req, res) => {
  res.json({
    success: true,
    isAdmin: req.user.role === "admin",
  });
});

// @route   PUT /api/auth/update-last-sync
// @desc    Update last sync time
// @access  Private
router.put("/update-last-sync", protect, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          lastSync: new Date(),
        },
      },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Last sync updated",
      lastSync: user.lastSync,
    });
  } catch (error) {
    console.error("Update Last Sync Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update last sync",
    });
  }
});

// @route   GET /api/auth/stats
// @desc    Get user statistics (Admin only)
// @access  Private/Admin
router.get("/stats", protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalActiveUsers = await User.countDocuments({ isActive: true });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today },
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAdmins,
        totalActiveUsers,
        newUsersToday,
      },
    });
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get statistics",
    });
  }
});

// @route   PUT /api/auth/users/:userId/toggle-active
// @desc    Toggle user active status (Admin only)
// @access  Private/Admin
router.put("/users/:userId/toggle-active", protect, admin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Prevent admin from deactivating themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: "You cannot deactivate your own account",
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error("Toggle Active Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle user status",
    });
  }
});

// ========================
// CART & WISHLIST ROUTES (Optional Extensions)
// ========================

// @route   GET /api/auth/cart
// @desc    Get user's cart
// @access  Private
router.get("/cart", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("cart").populate({
      path: "cart.product",
      select: "name price images stock",
    });

    res.json({
      success: true,
      cart: user.cart,
      count: user.cart.length,
    });
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cart",
    });
  }
});

// @route   GET /api/auth/wishlist
// @desc    Get user's wishlist
// @access  Private
router.get("/wishlist", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wishlist").populate({
      path: "wishlist",
      select: "name price images",
    });

    res.json({
      success: true,
      wishlist: user.wishlist,
      count: user.wishlist.length,
    });
  } catch (error) {
    console.error("Get Wishlist Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch wishlist",
    });
  }
});

module.exports = router;
