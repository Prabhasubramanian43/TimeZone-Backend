const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const adminAuth = require("../middleware/adminAuth");
const transporter = require("../config/mailer");

const router = express.Router();

// ======================================
// REGISTER CUSTOMER + WELCOME EMAIL
// ======================================

router.post("/register", async (req, res) => {
  try {
    const { name, email, mobile, address, password, confirmPassword } =
      req.body;

    if (!name || !email || !mobile || !address || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all fields.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    // Create customer account
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      address: address.trim(),
      password: await bcrypt.hash(password, 10),
      role: "customer",
    });

    // Send Welcome Email
    try {
      await transporter.sendMail({
        from: `"TIMEZONE Watches" <${process.env.SMTP_EMAIL}>`,
        to: user.email,
        subject: "Welcome to TIMEZONE Watches!",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #b8860b;">Welcome to TIMEZONE Watches!</h2>

            <p>Hello ${user.name},</p>

            <p>
              Thank you for registering with TIMEZONE Watches.
              Your account has been created successfully.
            </p>

            <p>
              You can now explore our watches and place your orders.
            </p>

            <h3>Happy Shopping!</h3>

            <p>TIMEZONE Watches Team</p>
          </div>
        `,
      });

      console.log("Registration welcome email sent:", user.email);
    } catch (emailError) {
      console.error("Registration email error:", emailError);
    }

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
});

// ======================================
// ADMIN-ONLY CUSTOMER STATISTICS
// ======================================

router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({
      role: { $ne: "admin" },
    });

    res.json({
      success: true,
      totalCustomers,
    });
  } catch (error) {
    console.error("Customer stats error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch customer statistics.",
    });
  }
});

// ======================================
// ADMIN-ONLY CUSTOMER LIST
// ======================================

router.get("/customers", adminAuth, async (req, res) => {
  try {
    const customers = await User.find({
      role: { $ne: "admin" },
    })
      .select("-password")
      .sort({ name: 1 });

    res.json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("Customer list error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch customers.",
    });
  }
});

// ======================================
// CUSTOMER LOGIN
// ======================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured on the server.",
      });
    }

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
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

    res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
});

module.exports = router;