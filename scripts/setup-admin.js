require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function setupAdmin() {
  const { MONGO_URI, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD) {
    throw new Error(
      "Set MONGO_URI, ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD in backend/.env first.",
    );
  }
  if (ADMIN_PASSWORD.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  }
  await mongoose.connect(MONGO_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = ADMIN_NAME.trim();
    existing.password = password;
    existing.role = "admin";
    await existing.save();
    console.log(`Admin account updated: ${email}`);
  } else {
    await User.create({
      name: ADMIN_NAME.trim(),
      email,
      password,
      role: "admin",
    });
    console.log(`Admin account created: ${email}`);
  }
  await mongoose.disconnect();
}
setupAdmin().catch(async (error) => {
  console.error("Admin setup failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
