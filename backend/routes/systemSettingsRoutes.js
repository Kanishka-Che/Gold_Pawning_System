import express from "express";

import {
  getSystemSettings,
  updateSystemSettings,
  getPrintingSettings,
} from "../controllers/systemSettingsController.js";

import {
  uploadLogo,
  getShopLogo,
  removeLogo,
} from "../controllers/shopLogoController.js";

import {
  uploadShopLogo,
} from "../middleware/logoUploadMiddleware.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All system settings APIs require authentication
router.use(protect);

// Admin and Staff can view shop logos
router.get(
  "/logos/:fileName",
  authorize("admin", "staff"),
  getShopLogo
);

// Admin and Staff can read printing settings
router.get(
  "/printing",
  authorize("admin", "staff"),
  getPrintingSettings
);

// Only Admin can upload or replace shop logo
router.post(
  "/logo",
  authorize("admin"),
  uploadShopLogo,
  uploadLogo
);

// Only Admin can remove shop logo
router.delete(
  "/logo",
  authorize("admin"),
  removeLogo
);

// Only Admin can view full system settings
router.get(
  "/",
  authorize("admin"),
  getSystemSettings
);

// Only Admin can update system settings
router.put(
  "/",
  authorize("admin"),
  updateSystemSettings
);

export default router;