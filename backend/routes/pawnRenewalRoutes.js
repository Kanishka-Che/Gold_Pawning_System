import express from "express";

import {
  getPawnRenewals,
  getPawnRenewalSummary,
} from "../controllers/pawnRenewalListController.js";

import {
  getPawnRenewalById,
} from "../controllers/pawnRenewalDetailsController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Admin and Staff only
router.use(authorize("admin", "staff"));

// GET /api/pawn-renewals/summary
router.get(
  "/summary",
  getPawnRenewalSummary
);

// GET /api/pawn-renewals
router.get(
  "/",
  getPawnRenewals
);

// GET /api/pawn-renewals/:id
router.get(
  "/:id",
  getPawnRenewalById
);

export default router;