
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
    throw new Error(
      "Only active loans can be renewed"
    );
  }

  const renewal = loan.settingsSnapshot?.renewal;

  if (!renewal || renewal.enabled !== true) {
    throw new Error(
      "Loan renewal is not enabled"
    );
  }

  if (
    !Number.isSafeInteger(
      renewal.durationMonths
    ) ||
    renewal.durationMonths < 1 ||
    renewal.durationMonths > 120
  ) {
    throw new Error(
      "Invalid renewal duration settings"
    );
  }

  if (
    typeof renewal.requireInterestSettlement !==
    "boolean"
  ) {
    throw new Error(
      "Invalid interest settlement settings"
    );
  }

  const fee = renewal.renewalFee;

  if (
    typeof fee !== "number" ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    throw new Error(
      "Invalid renewal fee settings"
    );
  }

  const cents = Math.round(fee * 100);

  if (
    !Number.isSafeInteger(cents) ||
    Math.abs(fee - cents / 100) > 1e-8
  ) {
    throw new Error(
      "Invalid renewal fee precision"
    );
  }

  return true;
};
