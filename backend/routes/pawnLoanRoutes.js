
import express from "express";

import {
  redeemPawnLoan,
  getPawnLoanRedemptionHistory,
} from "../controllers/pawnLoanRedemptionController.js";

import {
  previewLegacyPawnInterest,
} from "../controllers/legacyInterestController.js";

import {
  getLegacyTransactions,
  createLegacyTransaction,
  updateLegacyTransaction,
  removeLegacyTransaction,
  confirmLegacyHistory,
} from "../controllers/legacyTransactionController.js";

import {
  previewPawnLoanRenewal,
} from "../controllers/pawnLoanRenewalPreviewController.js";

import {
  getLegacyOpeningBalance,
  updateLegacyOpeningBalance,
  confirmLegacyOpeningBalance,
} from "../controllers/legacyOpeningBalanceController.js";

import {
  createLegacyPawnLoan,
  activateLegacyPawnLoan,
} from "../controllers/legacyPawnLoanController.js";

import {
  getPawnLoanPaymentHistory,
} from "../controllers/pawnLoanPaymentHistoryController.js";

import {
  getPawnLoanRedemptionPreview,
} from "../controllers/pawnLoanRedemptionPreviewController.js";

import {
  getPawnLoanTransactionHistory,
} from "../controllers/pawnLoanTransactionHistoryController.js";

import {
  getOverduePawnLoans,
} from "../controllers/pawnLoanOverdueController.js";

import {
  createPawnLoan,
  getPawnLoans,
  getPawnLoanById,
  cancelDraftPawnLoan,
  activatePawnLoan,
  getPawnLoanInterestPreview,
} from "../controllers/pawnLoanController.js";

import {
  renewPawnLoan,
  getPawnLoanRenewalHistory,
} from "../controllers/pawnLoanRenewalController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(protect);

// Create legacy pawn loan draft - Admin only
router.post(
  "/legacy",
  authorize("admin"),
  createLegacyPawnLoan
);


// Legacy pawn loan activation - Admin only
// Actual activation remains disabled.
router.patch(
  "/legacy/:id/activate",
  authorize("admin"),
  activateLegacyPawnLoan
);

// Read legacy opening balance - Admin only
router.get(
  "/legacy/:id/opening-balance",
  authorize("admin"),
  getLegacyOpeningBalance
);


// Create or update opening balance - Admin only
router.put(
  "/legacy/:id/opening-balance",
  authorize("admin"),
  updateLegacyOpeningBalance
);


// Verify opening balance - Admin only
router.patch(
  "/legacy/:id/opening-balance/verify",
  authorize("admin"),
  confirmLegacyOpeningBalance
);

// Read historical transactions - Admin only
router.get(
  "/legacy/:id/history",
  authorize("admin"),
  getLegacyTransactions
);


// Add historical transaction - Admin only
router.post(
  "/legacy/:id/history",
  authorize("admin"),
  createLegacyTransaction
);


// Update historical transaction - Admin only
router.put(
  "/legacy/:id/history/:transactionId",
  authorize("admin"),
  updateLegacyTransaction
);


// Void historical transaction - Admin only
router.patch(
  "/legacy/:id/history/:transactionId/void",
  authorize("admin"),
  removeLegacyTransaction
);


// Verify historical transaction history
router.patch(
  "/legacy/:id/history/verify",
  authorize("admin"),
  confirmLegacyHistory
);

// Legacy migration interest preview - Admin only
router.get(
  "/legacy/:id/interest-preview",
  authorize("admin"),
  previewLegacyPawnInterest
);

// Admin and Staff can create draft pawn loans
router.post(
  "/",
  authorize("admin", "staff"),
  createPawnLoan
);


router.get(
  "/",
  authorize("admin", "staff"),
  getPawnLoans
);

// GET /api/pawn-loans/overdue?page=1&limit=20
// Read-only overdue loan listing
router.get(
  "/overdue",
  authorize("admin", "staff"),
  getOverduePawnLoans
);



router.get(
  "/:id",
  authorize("admin", "staff"),
  getPawnLoanById
);


router.patch(
  "/:id/cancel",
  authorize("admin", "staff"),
  cancelDraftPawnLoan
);


// PATCH /api/pawn-loans/:id/activate
router.patch(
  "/:id/activate",
  authorize("admin", "staff"),
  activatePawnLoan
);


router.get(
  "/:id/interest-preview",
  authorize("admin", "staff"),
  getPawnLoanInterestPreview
);

router.get(
  "/:id/redemption-preview",
  authorize("admin", "staff"),
  getPawnLoanRedemptionPreview
);

// GET /api/pawn-loans/:id/renewal-preview
// Read-only renewal calculation

router.get(
  "/:id/renewal-preview",
  authorize("admin", "staff"),
  previewPawnLoanRenewal
);

// POST /api/pawn-loans/:id/renew
router.post(
  "/:id/renew",
  authorize("admin", "staff"),
  renewPawnLoan
);

// GET /api/pawn-loans/:id/renewals
router.get(
  "/:id/renewals",
  authorize("admin", "staff"),
  getPawnLoanRenewalHistory
);


/**
 * Pawn Loan Redemption
 * Actual posting and gold release remain disabled.
 */
router.post(
  "/:id/redeem",
  authorize("admin", "staff"),
  redeemPawnLoan
);

// Read-only pawn loan redemption history
router.get(
  "/:id/redemptions",
  authorize("admin", "staff"),
  getPawnLoanRedemptionHistory
);

// GET /api/pawn-loans/:id/transactions?page=1&limit=20
// Read-only combined transaction history
router.get(
  "/:id/transactions",
  authorize("admin", "staff"),
  getPawnLoanTransactionHistory
);


// GET /api/pawn-loans/:id/payments
// Read-only payment history
router.get(
  "/:id/payments",
  authorize("admin", "staff"),
  getPawnLoanPaymentHistory
);

export default router;
