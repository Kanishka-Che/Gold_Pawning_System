
import express from "express";
import { rateLimit } from "express-rate-limit";

import {
  loginUser,
  getCurrentUser,
  logoutUser,
  getSessionStatus,
  changeOwnPassword,
} from "../controllers/authController.js";

import {
  updateOwnProfileImage,
  removeOwnProfileImage,
  getProfileImage,
} from "../controllers/profileImageController.js";

import {
  uploadProfileImage,
} from "../middleware/profileImageUploadMiddleware.js";

import {
  protect,
  optionalAuth,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const profileImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  keyGenerator: (req) =>
    String(req.user._id),

  message: {
    success: false,
    message:
      "Too many profile image requests. Please try again later.",
  },
});

// Login Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  skipSuccessfulRequests: true,

  message: {
    success: false,
    message:
      "Too many login attempts. Please try again after 15 minutes.",
  },
});

// Own Password Change Rate Limiting
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  skipSuccessfulRequests: true,

  keyGenerator: (req) =>
    String(req.user._id),

  message: {
    success: false,
    message:
      "Too many password change attempts. Please try again later.",
  },
});

// Authentication Routes
router.post(
  "/login",
  loginLimiter,
  loginUser
);

router.get(
  "/me",
  protect,
  getCurrentUser
);

router.post(
  "/logout",
  protect,
  logoutUser
);

router.get(
  "/session",
  optionalAuth,
  getSessionStatus
);

router.patch(
  "/change-password",
  protect,
  passwordChangeLimiter,
  changeOwnPassword
);

router.post(
  "/profile-image",
  protect,
  profileImageLimiter,
  uploadProfileImage,
  updateOwnProfileImage
);

router.delete(
  "/profile-image",
  protect,
  profileImageLimiter,
  removeOwnProfileImage
);

router.get(
  "/profile-images/:fileName",
  protect,
  getProfileImage
);

export default router;
