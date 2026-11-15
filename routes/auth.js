const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const adminAuth = require("../middleware/adminAuth");
const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, mobile, address, password, confirmPassword } =
      req.body;
    if (!name || !email || !mobile || !address || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill in all fields." });
    }
    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must contain at least 6 characters.",
        });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered." });
    }
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      address: address.trim(),
      password: await bcrypt.hash(password, 10),
      role: "customer",
    });
    res
      .status(201)
      .json({ success: true, message: "Registration successful." });
  } catch (error) {
    console.error("Register error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during registration." });
  }
});

// Admin-only customer statistics
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({
      role: { $ne: "admin" },
    });
    res.json({ success: true, totalCustomers });
  } catch (error) {
    console.error("Customer stats error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Unable to fetch customer statistics.",
      });
  }
});

// Admin-only customer list
router.get("/customers", adminAuth, async (req, res) => {
  try {
    const customers = await User.find({ role: { $ne: "admin" } })
      .select("-password")
      .sort({ name: 1 });
    res.json({ success: true, count: customers.length, customers });
  } catch (error) {
    console.error("Customer list error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to fetch customers." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({
          success: false,
          message: "JWT_SECRET is not configured on the server.",
        });
    }
    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "customer",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during login." });
  }
});

module.exports = router;
