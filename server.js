const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");



const authRoutes = require("./routes/auth");
const feedbackRoutes = require("./routes/feedback");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ======================================
// MIDDLEWARE
// ======================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ======================================
// HOME ROUTE
// ======================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "TIMEZONE Watch API is running",
  });
});

// ======================================
// HEALTH CHECK
// ======================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    server: "running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// ======================================
// API ROUTES
// ======================================

app.use("/api/auth", authRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

// ======================================
// 404 HANDLER
// ======================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ======================================
// ERROR HANDLER
// ======================================

app.use((err, req, res, next) => {
  console.error("API error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ======================================
// START SERVER
// ======================================

async function startServer() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    // Connect MongoDB
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully!");
    console.log("Database:", mongoose.connection.name);

    // Verify Gmail SMTP Connection
  console.log("RESEND EMAIL SERVICE CONFIGURED!");

    // Start Express Server
    app.listen(PORT, () => {
      console.log(
        `TIMEZONE API running at http://localhost:${PORT}`,
      );
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();