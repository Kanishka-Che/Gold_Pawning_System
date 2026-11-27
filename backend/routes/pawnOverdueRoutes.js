import express from "express";

import {
  getPawnOverdueRecords,
  getPawnOverdueSummary,
  getPawnOverdueDetails,
} from "../controllers/pawnOverdueManagementController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Admin and Staff only
router.use(authorize("admin", "staff"));

// GET /api/pawn-overdue/summary
router.get(
  "/summary",
  getPawnOverdueSummary
);

// GET /api/pawn-overdue
router.get(
  "/",
  getPawnOverdueRecords
);

// GET /api/pawn-overdue/:id
router.get(
  "/:id",
  getPawnOverdueDetails
);

export default router;