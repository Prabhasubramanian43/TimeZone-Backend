const express = require("express");
const Feedback = require("../models/Feedback");
const transporter = require("../config/mailer");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const ADMIN_EMAIL = "prabhasubramanian35@gmail.com";

// POST Customer Feedback
router.post("/", async (req, res) => {
  try {
    const { name, email, feedback } = req.body;

    if (!name || !email || !feedback) {
      return res.status(400).json({
        message: "Please fill in all fields",
      });
    }

    // Save feedback in MongoDB
    const newFeedback = new Feedback({
      name,
      email,
      feedback,
    });

    await newFeedback.save();

    // Prepare Admin Email
    const adminEmail = {
      from: process.env.SMTP_EMAIL,
      to: ADMIN_EMAIL,
      subject: "New Customer Feedback - TIMEZONE Watches",
      text: `
New Customer Feedback

Name: ${name}
Email: ${email}

Feedback:
${feedback}
      `,
      html: `
        <h2>New Customer Feedback</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <h3>Feedback:</h3>
        <p>${feedback}</p>
      `,
    };

    // Prepare Customer Email
    const customerEmail = {
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: "Thank You for Your Feedback - TIMEZONE Watches",
      text: `
Hi ${name},

Thank you for sharing your valuable feedback with TIMEZONE Watches.

We appreciate your time and support!

Regards,
TIMEZONE Watches Team
      `,
      html: `
        <h2>Thank You, ${name}!</h2>
        <p>Thank you for sharing your valuable feedback with TIMEZONE Watches.</p>
        <p>We appreciate your time and support!</p>
        <br />
        <p>Regards,</p>
        <strong>TIMEZONE Watches Team</strong>
      `,
    };

    // Send both emails
    const emailResults = await Promise.allSettled([
      transporter.sendMail(adminEmail),
      transporter.sendMail(customerEmail),
    ]);

    emailResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(
          index === 0
            ? "Admin feedback email sent successfully"
            : "Customer feedback confirmation email sent successfully",
        );
      } else {
        console.error("Feedback email failed:", result.reason);
      }
    });

    res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    console.error("Feedback error:", error);

    res.status(500).json({
      message: "Unable to save feedback",
    });
  }
});

// GET - List feedback (newest first)
router.get("/", adminAuth, async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feedback.length,
      feedback,
    });
  } catch (error) {
    console.error("Get feedback error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch feedback",
    });
  }
});

// DELETE - Remove feedback by MongoDB ID
router.delete("/:id", adminAuth, async (req, res) => {
  const mongoose = require("mongoose");

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid feedback ID",
    });
  }

  try {
    const item = await Feedback.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    res.json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    console.error("Delete feedback error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete feedback",
    });
  }
});

module.exports = router;
