import express from "express";

import {
  getPawnRedemptions,
  getPawnRedemptionSummary,
} from "../controllers/pawnRedemptionListController.js";

import {
  getPawnRedemptionById,
} from "../controllers/pawnRedemptionDetailsController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Admin and Staff only
router.use(
  authorize("admin", "staff")
);

// GET /api/pawn-redemptions/summary
router.get(
  "/summary",
  getPawnRedemptionSummary
);

// GET /api/pawn-redemptions
router.get(
  "/",
  getPawnRedemptions
);

// GET /api/pawn-redemptions/:id
router.get(
  "/:id",
  getPawnRedemptionById
);

export default router;