import express from "express";

import {
  getDailyCollectionReport,
  getMonthlyCollectionReport,
  getPawnLoanIssueReport,
  getOutstandingPrincipalReport,
  getOverdueLoansReport,
  getRenewalReport,
  getRedemptionReport,
  getGoldInventoryReport,
  getCustomerReport,
  getFinancialSummaryReport,
} from "../controllers/reportsController.js";

import {
  exportReport,
} from "../controllers/reportExportController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Admin and Staff only
router.use(authorize("admin", "staff"));

router.get(
  "/:reportId/export",
  exportReport
);

// Daily Collection Report
router.get(
  "/daily-collections",
  getDailyCollectionReport
);

// Monthly Collection Report
router.get(
  "/monthly-collections",
  getMonthlyCollectionReport
);

// Pawn Loan Issue Report
router.get(
  "/loan-issues",
  getPawnLoanIssueReport
);

// Outstanding Principal Report
router.get(
  "/outstanding-principal",
  getOutstandingPrincipalReport
);

// Overdue Loans Report
router.get(
  "/overdue-loans",
  getOverdueLoansReport
);

// Renewal Report
router.get(
  "/renewals",
  getRenewalReport
);

// Redemption Report
router.get(
  "/redemptions",
  getRedemptionReport
);

// Gold Inventory Report
router.get(
  "/gold-inventory",
  getGoldInventoryReport
);

// Customer Report
router.get(
  "/customers",
  getCustomerReport
);

// Financial Summary Report
router.get(
  "/financial-summary",
  getFinancialSummaryReport
);

export default router;