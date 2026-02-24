const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * @desc   Protect routes (JWT auth)
 * @usage  router.get("/", protect, controller)
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // ✅ Check Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Get user (without password)
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found, please login again",
      });
    }

    // ✅ Optional: account status check
    if (user.status && user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // ✅ Attach user to request
    req.user = user;

    // ✅ IMPORTANT: call next()
    return next();
  } catch (error) {
    console.error("Auth error:", error);

    // JWT specific errors
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired, please login again",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }
};

/**
 * @desc   Check if user is accessing their own data
 * @usage  router.get("/:userId", protect, checkOwnership, controller)
 */
const checkOwnership = (req, res, next) => {
  try {
    // Check different possible parameter names
    const requestedUserId =
      req.params.userId || req.params.id || req.body.userId;

    // Agar koi userId param mein hai to check karo
    if (requestedUserId) {
      if (
        requestedUserId !== req.user.id &&
        requestedUserId !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access this user's data",
        });
      }
    }

    // Agar koi userId nahi hai, to assumedly logged in user apna data access kar raha hai
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking ownership",
    });
  }
};

/**
 * @desc   Check if address belongs to logged in user
 * @usage  router.delete("/addresses/:addressId", protect, checkAddressOwnership, controller)
 */
const checkAddressOwnership = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const addressId = req.params.addressId;
    if (addressId) {
      const address = user.addresses.find(
        (addr) => addr._id.toString() === addressId,
      );

      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found or does not belong to you",
        });
      }

      // Optional: attach address to request for further use
      req.address = address;
    }

    next();
  } catch (error) {
    console.error("Address ownership check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking address ownership",
    });
  }
};

/**
 * @desc   Admin only access
 * @usage  router.delete("/", protect, admin, controller)
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Admin access only",
  });
};

/**
 * @desc   Check if user is accessing their own profile OR is admin
 * @usage  router.get("/:userId", protect, selfOrAdmin, controller)
 */
const selfOrAdmin = (req, res, next) => {
  try {
    const requestedUserId = req.params.userId || req.params.id;

    // Admin can access anyone's data
    if (req.user.role === "admin") {
      return next();
    }

    // Non-admin can only access their own data
    if (
      requestedUserId &&
      requestedUserId !== req.user.id &&
      requestedUserId !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only access your own profile",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking permissions",
    });
  }
};

module.exports = {
  protect,
  admin,
  checkOwnership,
  checkAddressOwnership,
  selfOrAdmin,
};
