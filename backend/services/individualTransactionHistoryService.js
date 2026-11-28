
import mongoose from "mongoose";

import {
  getCombinedTransactionHistory,
} from "./combinedTransactionHistoryService.js";

import {
  validateTransactionHistoryRequest,
} from "../utils/transactionHistoryRequest.js";

export const getIndividualTransactionHistory =
  async ({
    req,
    transactionType,
  }) => {
    const {
      loanId,
      page,
      limit,
    } = validateTransactionHistoryRequest(req);

    const session = await mongoose.startSession();

    try {
      let history;

      await session.withTransaction(
        async () => {
          history =
            await getCombinedTransactionHistory({
              req,
              loanId,
              page,
              limit,
              transactionType,
              session,
            });
        },
        {
          readConcern: {
            level: "snapshot",
          },

          readPreference: "primary",
        }
      );

      return history;
    } finally {
      await session.endSession();
    }
  };


export const handleTransactionHistoryError = (
  res,
  error
) => {
  if (
    [400, 401, 403, 404, 409].includes(
      error.statusCode
    )
  ) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.code === 112 ||
    error.hasErrorLabel?.(
      "TransientTransactionError"
    )
  ) {
    return res.status(409).json({
      success: false,

      message:
        "Transaction history changed. Reload and try again.",
    });
  }

  console.error(
    "Individual Transaction History Error:",
    error.name,
    error.code
  );

  return res.status(500).json({
    success: false,

    message:
      "Failed to retrieve transaction history",
  });
};
