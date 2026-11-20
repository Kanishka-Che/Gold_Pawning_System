
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import User from "../models/User.js";
import connectDB from "../config/db.js";

const rl = createInterface({
  input: stdin,
  output: stdout,
});

try {
  await connectDB();

  const admin = await User.findOne({
    username: "admin",
    role: "admin",
  });

  if (!admin) {
    throw new Error("Admin account not found");
  }

  const password = await rl.question(
    "Enter new Admin password (minimum 12 characters): "
  );

  if (password.length < 12) {
    throw new Error("Password must have at least 12 characters");
  }

  admin.password = await bcrypt.hash(password, 12);
  await admin.save();

  console.log("Admin password updated successfully");
} catch (error) {
  console.error("Error:", error.message);
} finally {
  rl.close();
  await mongoose.disconnect();
}
