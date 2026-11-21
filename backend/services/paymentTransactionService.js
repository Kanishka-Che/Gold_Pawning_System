
import mongoose from "mongoose";

/**
 * Execute a payment-related operation inside
 * a MongoDB transaction.
 *
 * This helper does NOT calculate interest,
 * allocate payments, or record money.
 */
export const withPaymentTransaction = async (
  operation
) => {
  if (typeof operation !== "function") {
    throw new TypeError(
      "Payment transaction operation must be a function"
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(
      async () => {
        result = await operation(session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );

    return result;
  } finally {
    await session.endSession();
  }
};
