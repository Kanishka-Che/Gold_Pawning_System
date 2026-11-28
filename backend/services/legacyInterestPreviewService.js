
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

import LegacyPawnTransaction
  from "../models/LegacyPawnTransaction.js";

import PawnPayment from "../models/PawnPayment.js";

import PawnLoanRenewal
  from "../models/PawnLoanRenewal.js";

import PawnLoanRedemption
  from "../models/PawnLoanRedemption.js";

import {
  calculateLegacyPawnInterest,
} from "./legacyInterestCalculatorService.js";

import {
  LegacyInterestError,
} from "../utils/legacyInterestValidator.js";


const MAX_HISTORY_RECORDS = 1000;


export const getLegacyInterestPreview = async ({
  req,
  loanId,
  session,
  calculationDate = new Date(),
}) => {
  // 1. Administrator access only
  if (
    !req.user?._id ||
    req.user.role !== "admin" ||
    req.user.isActive !== true
  ) {
    throw new LegacyInterestError(
      "Administrator access required",
      403
    );
  }

  // 2. Validate database transaction
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Active database transaction is required"
    );
  }

  // 3. Validate loan ID
  if (
    typeof loanId !== "string" ||
    !mongoose.isObjectIdOrHexString(loanId)
  ) {
    throw new LegacyInterestError(
      "Invalid pawn loan ID",
      400
    );
  }

  // 4. Load legacy pawn loan
  const loan = await PawnLoan.findOne({
    _id: loanId,
    recordSource: "legacy",
  })
    .session(session)
    .lean();

  if (!loan) {
    throw new LegacyInterestError(
      "Legacy pawn loan not found",
      404
    );
  }

  // 5. Only verified migration drafts
  if (loan.status !== "draft") {
    throw new LegacyInterestError(
      "Only draft legacy loans support migration interest preview"
    );
  }

  if (
    loan.legacyMigrationStatus !== "verified"
  ) {
    throw new LegacyInterestError(
      "Verify historical financial data before calculating interest"
    );
  }

  // 6. Prevent mixing historical and live transactions
  const existingPayment =
    await PawnPayment.exists({
      pawnLoan: loan._id,
    }).session(session);

  const existingRenewal =
    await PawnLoanRenewal.exists({
      pawnLoan: loan._id,
    }).session(session);

  const existingRedemption =
    await PawnLoanRedemption.exists({
      pawnLoan: loan._id,
    }).session(session);

  if (
    existingPayment ||
    existingRenewal ||
    existingRedemption
  ) {
    throw new LegacyInterestError(
      "Unexpected live financial transactions exist for this migration draft"
    );
  }

  // 7. Load all historical transactions
  const transactions =
    await LegacyPawnTransaction.find({
      pawnLoan: loan._id,
    })
      .sort({
        sequenceNumber: 1,
        _id: 1,
      })
      .limit(MAX_HISTORY_RECORDS + 1)
      .session(session)
      .lean();

  if (
    transactions.length >
    MAX_HISTORY_RECORDS
  ) {
    throw new LegacyInterestError(
      "Historical transaction limit exceeded"
    );
  }

  // 8. Prevent mixing migration modes
  if (
    loan.legacyHistoryMode === "opening_balance" &&
    transactions.length > 0
  ) {
    throw new LegacyInterestError(
      "Opening balance loans cannot contain historical transactions"
    );
  }

  // 9. Calculate provisional interest
  const preview = calculateLegacyPawnInterest({
    loan,
    transactions,
    calculationDate,
  });

  // 10. Return read-only preview
  return {
    ...preview,

    openingBalanceVersion:
      loan.openingBalanceVersion ?? null,

    historyVersion:
      loan.legacyHistoryVersion ?? null,

    historicalDataVerified: true,

    interestRulesConfirmed:
      loan.legacyRulesStatus === "confirmed",

    requiresOwnerConfirmation: true,

    requiresInterestReconciliation: true,

    isProvisional: true,

    isFinalSettlementAmount: false,

    canActivate: false,

    canRecordPayment: false,

    canRenew: false,

    canRedeem: false,
  };
};
