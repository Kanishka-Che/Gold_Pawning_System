
import "dotenv/config";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import connectDB from "../config/db.js";

const createAdmin = async () => {
  try {
    const username = process.env.INITIAL_ADMIN_USERNAME
      ?.trim()
      .toLowerCase();

    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!username || !password || password.length < 12) {
      throw new Error(
        "Set INITIAL_ADMIN_USERNAME and a password of at least 12 characters"
      );
    }

    await connectDB();

    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      console.log("An Admin account already exists.");
      return;
    }

    const existingUsername = await User.findOne({
      username,
    });

    if (existingUsername) {
      throw new Error("Username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      username,
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    console.log("Initial Admin account created successfully");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
  }
};

createAdmin();
