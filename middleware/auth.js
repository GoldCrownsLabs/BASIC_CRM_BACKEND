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

module.exports = {
  protect,
  admin,
};
