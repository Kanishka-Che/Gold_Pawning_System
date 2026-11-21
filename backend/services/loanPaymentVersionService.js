
import mongoose from "mongoose";
import PawnLoan from "../models/PawnLoan.js";

/**
 * Atomically claim the expected payment version
 * of an active pawn loan.
 *
 * Must be called inside a MongoDB transaction.
 */
export const incrementLoanPaymentVersion = async ({
  loanId,
  expectedVersion,
  session,
}) => {
  if (
    !mongoose.isObjectIdOrHexString(loanId) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    !session?.inTransaction?.()
  ) {
    throw new Error(
      "Invalid loan payment version update parameters"
    );
  }

  const result = await PawnLoan.updateOne(
    {
      _id: loanId,
      status: "active",
      paymentVersion: expectedVersion,
    },
    {
      $inc: { paymentVersion: 1 },
    },
    { session }
  );

  if (result.modifiedCount !== 1) {
    const error = new Error(
      "Loan payment version conflict or loan is not active"
    );

    error.statusCode = 409;
    throw error;
  }

  return expectedVersion + 1;
};
