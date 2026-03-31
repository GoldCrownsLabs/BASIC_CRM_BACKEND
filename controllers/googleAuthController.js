const User = require("../models/User");
const GoogleAuth = require("../models/GoogleAuth");
const jwt = require("jsonwebtoken");

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || "dev_secret_key_for_testing",
    { expiresIn: "30d" },
  );
};

// ========================
// GOOGLE AUTH CONTROLLERS
// ========================

// @desc    Google Login/Register
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    const {
      email,
      name,
      googleId,
      avatar,
      accessToken,
      refreshToken,
      metadata,
    } = req.body;

    // Validation
    if (!email || !googleId) {
      return res.status(400).json({
        success: false,
        error: "Email and Google ID are required",
      });
    }

    console.log(`🔐 Google login attempt: ${email}`);

    let user;
    let googleAuth;

    // Check if Google auth exists
    googleAuth = await GoogleAuth.findByGoogleId(googleId);

    if (googleAuth) {
      // Existing Google user
      user = googleAuth.userId;

      // Update login info
      await GoogleAuth.updateLoginInfo(googleId, { accessToken, refreshToken });

      console.log(`✅ Google login: Existing user ${email}`);
    } else {
      // Check if user exists with same email
      user = await User.findOne({ email });

      if (user) {
        // User exists but not linked to Google - link it
        console.log(`🔗 Linking Google account to existing user: ${email}`);
      } else {
        // Create new user
        const userData = {
          name: name || email.split("@")[0],
          email: email,
          emailVerified: true,
          isActive: true,
          role: "user",
          theme: "light",
          lastLogin: new Date(),
          lastSync: new Date(),
          newsletterSubscription: true,
          profileImage: avatar || "",
          avatar: avatar || "",
        };

        user = await User.create(userData);
        console.log(`✅ New user created: ${email}`);
      }

      // Create Google auth record
      googleAuth = await GoogleAuth.create({
        userId: user._id,
        googleId: googleId,
        email: email,
        name: name,
        avatar: avatar,
        accessToken: accessToken,
        refreshToken: refreshToken,
        metadata: metadata || {},
      });

      console.log(`✅ Google auth record created for: ${email}`);
    }

    // Update user last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Format user response with ISO strings for dates
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      avatar: user.avatar || user.profileImage || "",
      profileImage: user.profileImage || "",
      theme: user.theme || "light",
      role: user.role || "user",
      emailVerified: user.emailVerified || false,
      isActive: user.isActive !== false,
      lastLogin: user.lastLogin
        ? user.lastLogin.toISOString()
        : new Date().toISOString(),
      createdAt: user.createdAt
        ? user.createdAt.toISOString()
        : new Date().toISOString(),
      googleLinked: true,
    };

    // Send response
    res.status(200).json({
      success: true,
      message:
        googleAuth && googleAuth._id
          ? "Google login successful"
          : "Account created successfully",
      token,
      user: userResponse,
      googleAuth:
        googleAuth && googleAuth._id
          ? {
              googleId: googleAuth.googleId,
              loginCount: googleAuth.loginCount || 1,
              lastLoginAt: googleAuth.lastLoginAt || new Date(),
            }
          : null,
    });
  } catch (error) {
    console.error("❌ Google Login Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Account already linked to another user",
      });
    }

    res.status(500).json({
      success: false,
      error: "Google login failed. Please try again.",
    });
  }
};

// @desc    Get Google Auth Info
// @route   GET /api/auth/google/info
// @access  Private
exports.getGoogleAuthInfo = async (req, res) => {
  try {
    const googleAuth = await GoogleAuth.findOne({ userId: req.user.id });

    if (!googleAuth) {
      return res.status(404).json({
        success: false,
        error: "Google account not linked",
      });
    }

    res.json({
      success: true,
      data: {
        googleId: googleAuth.googleId,
        email: googleAuth.email,
        name: googleAuth.name,
        avatar: googleAuth.avatar,
        loginCount: googleAuth.loginCount,
        lastLoginAt: googleAuth.lastLoginAt,
        linkedAt: googleAuth.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Get Google Auth Info Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Google auth info",
    });
  }
};

// @desc    Unlink Google Account
// @route   DELETE /api/auth/google/unlink
// @access  Private
exports.unlinkGoogleAccount = async (req, res) => {
  try {
    const googleAuth = await GoogleAuth.findOneAndDelete({
      userId: req.user.id,
    });

    if (!googleAuth) {
      return res.status(404).json({
        success: false,
        error: "Google account not linked",
      });
    }

    // Check if user has password set
    const user = await User.findById(req.user.id);
    if (!user.password) {
      // User only had Google login, ask to set password
      return res.status(400).json({
        success: false,
        error: "You need to set a password before unlinking Google account",
        requiresPasswordSetup: true,
      });
    }

    res.json({
      success: true,
      message: "Google account unlinked successfully",
    });
  } catch (error) {
    console.error("❌ Unlink Google Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to unlink Google account",
    });
  }
};

// @desc    Refresh Google Token
// @route   POST /api/auth/google/refresh-token
// @access  Private
exports.refreshGoogleToken = async (req, res) => {
  try {
    const googleAuth = await GoogleAuth.findOne({ userId: req.user.id });

    if (!googleAuth) {
      return res.status(404).json({
        success: false,
        error: "Google account not linked",
      });
    }

    res.json({
      success: true,
      data: {
        accessToken: googleAuth.accessToken,
        refreshToken: googleAuth.refreshToken,
      },
    });
  } catch (error) {
    console.error("❌ Refresh Google Token Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh token",
    });
  }
};
