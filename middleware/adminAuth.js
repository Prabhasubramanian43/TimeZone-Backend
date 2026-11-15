const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function adminAuth(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ success: false, message: "JWT_SECRET is not configured." });
    }
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Please login as admin." });
    }
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user || user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access only." });
    }
    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({
        success: false,
        message: "Session expired. Please login again.",
      });
  }
};
