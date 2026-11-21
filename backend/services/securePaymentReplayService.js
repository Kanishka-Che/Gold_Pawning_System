
import { verifyPaymentLoanAccess } from "./paymentLoanAccessService.js";

import { checkPaymentReplay } from "./paymentReplayDecisionService.js";

/**
 * Securely checks whether a payment request is:
 * - new
 * - replay
 * - conflict
 *
 * This service NEVER records a payment.
 */
export const checkSecurePaymentReplay = async ({
  idempotencyKey,
  request,
  user,
  session = null,
}) => {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    throw new Error("Invalid payment request");
  }

  // Never trust recordedBy supplied by the frontend.
  const authenticatedRequest = {
    pawnLoanId: request.pawnLoanId,
    amount: request.amount,
    paymentMethod: request.paymentMethod,
    reference: request.reference ?? "",
    recordedBy: user?._id,
  };

  // Verify loan existence and user access first.
  const loan = await verifyPaymentLoanAccess({
    loanId: authenticatedRequest.pawnLoanId,
    user,
    session,
  });

  // Determine whether this is a new request or retry.
  const replayResult = await checkPaymentReplay({
    idempotencyKey,
    request: authenticatedRequest,
    session,
  });

  return {
    status: replayResult.status,
    loan,
    payment: replayResult.payment,
  };
};
