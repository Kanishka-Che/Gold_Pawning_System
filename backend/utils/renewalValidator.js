
import mongoose from "mongoose";

export const validateRenewalRequest = ({
  pawnLoanId,
  idempotencyKey,
  notes = "",
}) => {
  if (
    typeof pawnLoanId !== "string" ||
    !mongoose.isObjectIdOrHexString(pawnLoanId)
  ) {
    throw new Error("Invalid pawn loan ID");
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(idempotencyKey)
  ) {
    throw new Error("Invalid renewal idempotency key");
  }

  if (
    typeof notes !== "string" ||
    notes.length > 500
  ) {
    throw new Error("Invalid renewal notes");
  }

  return {
    pawnLoanId,
    idempotencyKey,
    notes: notes.trim(),
  };
};

export const validateRenewalEligibility = ({
  loan,
}) => {
  if (!loan || typeof loan !== "object") {
    throw new Error("Invalid pawn loan");
  }

  if (loan.status !== "active") {
    throw new Error("Only active loans can be renewed");
  }

  if (
    loan.settingsSnapshot?.renewal?.enabled !== true
  ) {
    throw new Error("Loan renewal is not enabled");
  }

  return true;
};
