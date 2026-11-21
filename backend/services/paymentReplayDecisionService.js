
import { findExistingPayment } from "./paymentIdempotencyService.js";

import { validatePaymentReplay } from "../utils/paymentReplayValidator.js";

/**
 * Determine whether a payment request is:
 * - new
 * - replay
 * - conflict
 *
 * Read-only: never records a payment.
 */
export const checkPaymentReplay = async ({
  idempotencyKey,
  request,
  session = null,
}) => {
  // Validate the key and look for an existing payment.
  const existingPayment = await findExistingPayment({
    idempotencyKey,
    session,
  });

  if (!existingPayment) {
    return {
      status: "new",
      payment: null,
    };
  }

  const status = validatePaymentReplay({
    existingPayment,
    request,
  });

  return {
    status,
    payment: existingPayment,
  };
};
