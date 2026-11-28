
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

import {
  calculatePawnLoanInterestPreview,
} from "../controllers/pawnLoanController.js";

import {
  calculateLoanBalanceSummary,
} from "../utils/loanBalanceSummary.js";


export class LoanBalanceError extends Error {
  constructor(
    message,
    statusCode = 409,
    code = "LOAN_BALANCE_ERROR"
  ) {
    super(message);

    this.name = "LoanBalanceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}


export const getLoanFinancialBalance = async ({
  loanId,
  session,
  calculationDate = new Date(),
}) => {
  // 1. Validate loan ID
  if (
    typeof loanId !== "string" ||
    !mongoose.isObjectIdOrHexString(loanId)
  ) {
    throw new LoanBalanceError(
      "Invalid pawn loan ID",
      400
    );
  }

  // 2. Require a consistent database snapshot
  if (
    !session ||
    !session.inTransaction()
  ) {
    throw new Error(
      "Active database transaction is required"
    );
  }

  // 3. Validate calculation date
  if (
    !(calculationDate instanceof Date) ||
    !Number.isFinite(
      calculationDate.getTime()
    ) ||
    calculationDate > new Date()
  ) {
    throw new LoanBalanceError(
      "Invalid calculation date",
      400
    );
  }

  // 4. Identify the loan source
  const loanSource = await PawnLoan.findById(
    loanId
  )
    .select(
      "_id recordSource status " +
      "legacyMigrationStatus legacyRulesStatus"
    )
    .session(session)
    .lean();

  if (!loanSource) {
    throw new LoanBalanceError(
      "Pawn loan not found",
      404
    );
  }

  // 5. Legacy financial safety guard
  if (loanSource.recordSource === "legacy") {
    throw new LoanBalanceError(
      "Legacy financial operations require " +
      "verified balances and confirmed business rules",
      409,
      "LEGACY_FINANCIAL_OPERATIONS_DISABLED"
    );
  }

  // Support older new-loan records that were
  // created before recordSource was introduced.
  const recordSource =
    loanSource.recordSource ?? "new";

  if (recordSource !== "new") {
    throw new LoanBalanceError(
      "Unsupported loan record source"
    );
  }

  // 6. Require an active loan
  if (loanSource.status !== "active") {
    throw new LoanBalanceError(
      "Only active loans support financial previews"
    );
  }

  // 7. Reuse the existing new-loan calculation
  const {
    loan,
    payments,
    preview: interestPreview,
  } = await calculatePawnLoanInterestPreview({
    loanId,
    session,
    calculationDate,
  });

  // 8. Calculate standardized outstanding balance
  const balance = calculateLoanBalanceSummary({
    originalPrincipal: loan.principalAmount,

    accruedInterest:
      interestPreview.accruedInterest,

    payments,
  });

  // 9. Return common financial balance
  return {
    loan,

    payments,

    interestPreview,

    balance,

    recordSource,

    calculationDate,

    effectiveMaturityDate:
      loan.maturityDate,

    currency: "LKR",

    isProvisional: true,

    isFinalSettlementAmount: false,

    financialPostingEnabled: false,
  };
};
