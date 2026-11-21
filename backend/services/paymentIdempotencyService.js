
import PawnPayment from "../models/PawnPayment.js";

/**
 * Find an existing payment by idempotency key.
 *
 * This service is read-only.
 * It does not create or modify payments.
 */
export const findExistingPayment = async ({
  idempotencyKey,
  session = null,
}) => {
  // Validate idempotency key
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(idempotencyKey)
  ) {
    throw new Error("Invalid payment idempotency key");
  }

  // Validate optional MongoDB session
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

  // Find payment by its unique idempotency key
  const query = PawnPayment.findOne({
    idempotencyKey,
  });

  // Use transaction session if provided
  if (session !== null) {
    query.session(session);
  }

  // Return payment or null
  return query.lean().exec();
};
