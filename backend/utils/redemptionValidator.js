
import mongoose from "mongoose";

/**
 * Validate redemption request.
 * No database writes or financial posting.
 */
export const validateRedemptionRequest = ({
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
    !/^[a-zA-Z0-9_-]{16,128}$/.test(idempotencyKey)
  ) {
    throw new Error("Invalid redemption idempotency key");
  }

  if (
    typeof notes !== "string" ||
    notes.length > 500
  ) {
    throw new Error("Invalid redemption notes");
  }

  return {
    pawnLoanId,
    idempotencyKey,
    notes: notes.trim(),
  };
};

/**
 * Validate loan eligibility for redemption.
 *
 * This does not confirm that the financial
 * balance has been fully settled.
 */
export const validateRedemptionEligibility = ({
  loan,
}) => {
  if (!loan || typeof loan !== "object") {
    throw new Error("Pawn loan is required");
  }

  if (loan.status !== "active") {
    throw new Error(
      "Only active pawn loans can be redeemed"
    );
  }

  if (
    !Array.isArray(loan.goldItems) ||
    loan.goldItems.length === 0
  ) {
    throw new Error(
      "Pawn loan must contain gold items"
    );
  }

  const goldItemIds = loan.goldItems.map(String);

  if (
    goldItemIds.some(
      (id) => !mongoose.isObjectIdOrHexString(id)
    ) ||
    new Set(goldItemIds).size !== goldItemIds.length
  ) {
    throw new Error(
      "Pawn loan contains invalid or duplicate gold items"
    );
  }

  return true;
};

/**
 * Validate that all gold items are still
 * pledged to the specified pawn loan.
 *
 * This is an eligibility check only.
 */
export const validateRedemptionGoldItems = ({
  loan,
  goldItems,
}) => {
  if (!loan || !Array.isArray(loan.goldItems)) {
    throw new Error("Invalid pawn loan");
  }

  if (
    !Array.isArray(goldItems) ||
    goldItems.length !== loan.goldItems.length
  ) {
    throw new Error(
      "Gold item count does not match the pawn loan"
    );
  }

  const expectedIds = new Set(
    loan.goldItems.map(String)
  );

  const seenIds = new Set();

  for (const item of goldItems) {
    if (!item?._id) {
      throw new Error("Invalid gold item");
    }

    const itemId = String(item._id);

    if (
      !mongoose.isObjectIdOrHexString(itemId) ||
      !expectedIds.has(itemId) ||
      seenIds.has(itemId)
    ) {
      throw new Error(
        "Gold item does not belong to this pawn loan"
      );
    }

    seenIds.add(itemId);

    if (item.status !== "pledged") {
      throw new Error(
        "Gold item is not currently pledged"
      );
    }

    if (
      String(item.reservedForLoan ?? "") !==
      String(loan._id)
    ) {
      throw new Error(
        "Gold item reservation does not match the pawn loan"
      );
    }
  }

  return true;
};
