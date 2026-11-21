
import express from "express";
import { rateLimit } from "express-rate-limit";

import {
  loginUser,
  getCurrentUser,
  logoutUser,
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

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

// Authentication Routes
router.post("/login", loginLimiter, loginUser);

router.get("/me", protect, getCurrentUser);

router.post("/logout", protect, logoutUser);

export default router;
