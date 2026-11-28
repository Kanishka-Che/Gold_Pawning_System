
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";
import mongoose from "mongoose";
import { createAuditLog } from "../utils/auditLogger.js";
import { validateNewPassword } from "../utils/passwordValidator.js";

const COOKIE_NAME = "sigiri_auth";
const TOKEN_LIFETIME = 8 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const user = await User.findOne({
      username: username.trim().toLowerCase(),
    }).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME);

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        sessionId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
        algorithm: "HS256",
      }
    );

    await Session.create({
      userId: user._id,
      sessionId,
      expiresAt,
    });

    res.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: TOKEN_LIFETIME,
    });

    return res.json({
      success: true,
      message: "Login successful",
     user: {
  id: user._id,
  username: user.username,
  role: user.role,
  profileImage: user.profileImage || null,
},
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};


export const getCurrentUser = (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    success: true,

    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
      isActive: req.user.isActive,

      profileImage:
        req.user.profileImage || null,

      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
};


export const logoutUser = async (req, res) => {
  try {
    await Session.updateOne(
      {
        sessionId: req.sessionId,
        userId: req.user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      }
    );

    res.clearCookie(COOKIE_NAME, cookieOptions);

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};



export const getSessionStatus = (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    success: true,

    authenticated: Boolean(req.user),

    user: req.user
      ? {
          id: req.user._id,
          username: req.user.username,
          role: req.user.role,

          profileImage:
            req.user.profileImage || null,
        }
      : null,
  });
};


export const changeOwnPassword = async (req, res) => {
  let session;

  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      Buffer.byteLength(currentPassword, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid current password is required",
      });
    }

    const validationError =
      validateNewPassword(newPassword);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const user = await User.findById(
      req.user._id
    ).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable",
      });
    }

    const validPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from current password",
      });
    }

    const oldPasswordHash = user.password;

    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const activeSession = await Session.findOne({
        userId: user._id,
        sessionId: req.sessionId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (!activeSession) {
        const error = new Error(
          "Session expired. Please login again."
        );

        error.statusCode = 401;
        throw error;
      }

      const result = await User.updateOne(
        {
          _id: user._id,
          isActive: true,
          password: oldPasswordHash,
        },
        {
          $set: {
            password: hashedPassword,
          },
        },
        { session }
      );

      if (result.matchedCount !== 1) {
        const error = new Error(
          "Account changed. Please login again."
        );

        error.statusCode = 409;
        throw error;
      }

      const revokedSessions =
        await Session.updateMany(
          {
            userId: user._id,
            revokedAt: null,
          },
          {
            $set: {
              revokedAt: new Date(),
            },
          },
          { session }
        );

      await createAuditLog({
        req,
        action: "USER_PASSWORD_CHANGED",
        targetType: "User",
        targetId: user._id,
        details: {
          username: user.username,
          sessionsRevoked: true,
          revokedSessionCount:
            revokedSessions.modifiedCount,
        },
        session,
      });
    });

    res.clearCookie(
      COOKIE_NAME,
      cookieOptions
    );

    return res.status(200).json({
      success: true,
      message:
        "Password changed successfully. Please login again.",
      requiresLogin: true,
    });
  } catch (error) {
    if ([401, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Change Password Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
