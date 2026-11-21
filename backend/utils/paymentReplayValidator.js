
import mongoose from "mongoose";

/**
 * Compare an existing payment with a retry request.
 *
 * Returns "replay" or "conflict".
 * Does not create or update any payment.
 */
export const validatePaymentReplay = ({
  existingPayment,
  request,
}) => {
  if (
    !existingPayment ||
    typeof existingPayment !== "object" ||
    !request ||
    typeof request !== "object"
  ) {
    throw new Error("Invalid payment replay comparison");
  }

  const {
    pawnLoanId,
    amount,
    paymentMethod,
    reference = "",
    recordedBy,
  } = request;

  if (
    !mongoose.isObjectIdOrHexString(pawnLoanId) ||
    !mongoose.isObjectIdOrHexString(recordedBy) ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.abs(amount - Math.round(amount * 100) / 100) > 1e-8 ||
    !["cash", "bank_transfer"].includes(paymentMethod) ||
    typeof reference !== "string"
  ) {
    throw new Error("Invalid payment replay request");
  }

  const sameLoan =
    String(existingPayment.pawnLoan) === String(pawnLoanId);

  const sameAmount =
    Number.isFinite(existingPayment.amount) &&
    Math.round(existingPayment.amount * 100) ===
      Math.round(amount * 100);

  const sameMethod =
    existingPayment.paymentMethod === paymentMethod;

  const sameReference =
    (existingPayment.reference ?? "") === reference.trim();

  const sameCashier =
    String(existingPayment.recordedBy) === String(recordedBy);

  if (
    sameLoan &&
    sameAmount &&
    sameMethod &&
    sameReference &&
    sameCashier
  ) {
    return "replay";
  }

  return "conflict";
};
