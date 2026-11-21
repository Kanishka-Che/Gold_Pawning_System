
import express from "express";

import {
  redeemPawnLoan,
  getPawnLoanRedemptionHistory,
} from "../controllers/pawnLoanRedemptionController.js";

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


export default router;
