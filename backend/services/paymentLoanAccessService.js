
import mongoose from "mongoose";
import PawnLoan from "../models/PawnLoan.js";

export const verifyPaymentLoanAccess = async ({
  loanId,
  user,
  session = null,
}) => {
  if (!mongoose.isObjectIdOrHexString(loanId)) {
    const error = new Error("Invalid pawn loan ID");
    error.statusCode = 400;
    throw error;
  }

  if (
    !user?._id ||
    !mongoose.isObjectIdOrHexString(user._id) ||
    !["admin", "staff"].includes(user.role) ||
    user.isActive !== true
  ) {
    const error = new Error("Payment access denied");
    error.statusCode = 403;
    throw error;
  }

  if (
    session !== null &&
    (
      typeof session !== "object" ||
      typeof session.inTransaction !== "function" ||
      typeof session.endSession !== "function"
    )
  ) {
    throw new Error("Invalid MongoDB session");
  }

  const query = PawnLoan.findById(loanId)
    .select("_id status customer paymentVersion");

  if (session !== null) {
    query.session(session);
  }

  const loan = await query.lean().exec();

  if (!loan) {
    const error = new Error("Pawn loan not found");
    error.statusCode = 404;
    throw error;
  }

  return loan;
};
