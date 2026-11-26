
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";

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
  return res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
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
        }
      : null,
  });
};
