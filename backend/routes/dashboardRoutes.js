import express from "express";

import {
  getDashboardSummary,
  getDashboardFinancialOverview,
  getDashboardLoanStatus,
  getDashboardRecentActivity,
} from "../controllers/dashboardController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required.
router.use(protect);

// Admin and Staff access.
router.use(authorize("admin", "staff"));

// Dashboard summary.
router.get(
  "/summary",
  getDashboardSummary
);

// Monthly financial overview.
router.get(
  "/financial-overview",
  getDashboardFinancialOverview
);

// Pawn loan status analytics.
router.get(
  "/loan-status",
  getDashboardLoanStatus
);

// Recent dashboard activity.
router.get(
  "/recent-activity",
  getDashboardRecentActivity
);

export default router;