import mongoose from "mongoose";

import {
  getLegacyTransactionHistory,
  addLegacyTransaction,
  editLegacyTransaction,
  voidLegacyTransaction,
  verifyLegacyTransactionHistory,
} from "../services/legacyTransactionService.js";


const executeHistoryOperation = async ({
  req,
  res,
  operation,
  successStatus = 200,
  successMessage,
}) => {
  let session;

  res.set("Cache-Control", "no-store");

  try {
    session = await mongoose.startSession();

    let result;

    await session.withTransaction(
      async () => {
        result = await operation({
          req,

          loanId: req.params.id,

          transactionId:
            req.params.transactionId,

          input: req.body,

          session,
        });
      },
      {
        readConcern: {
          level: "snapshot",
        },

        writeConcern: {
          w: "majority",
        },

        readPreference: "primary",
      }
    );

    return res.status(successStatus).json({
      success: true,

      message: successMessage,

      ...result,
    });

  } catch (error) {
    if (
      [400, 401, 403, 404, 409].includes(
        error.statusCode
      )
    ) {
      return res.status(
        error.statusCode
      ).json({
        success: false,

        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message:
          "Duplicate historical transaction detected",
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
          "Historical transaction conflict. Reload and try again.",
      });
    }

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid historical transaction data",
      });
    }

    console.error(
      "Legacy Transaction Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to process historical transactions",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};


// GET historical transactions
export const getLegacyTransactions = (
  req,
  res
) =>
  executeHistoryOperation({
    req,
    res,

    operation:
      getLegacyTransactionHistory,

    successMessage:
      "Historical transactions retrieved successfully",
  });


// POST historical transaction
export const createLegacyTransaction = (
  req,
  res
) =>
  executeHistoryOperation({
    req,
    res,

    operation: addLegacyTransaction,

    successStatus: 201,

    successMessage:
      "Historical transaction created successfully",
  });


// PUT historical transaction
export const updateLegacyTransaction = (
  req,
  res
) =>
  executeHistoryOperation({
    req,
    res,

    operation: editLegacyTransaction,

    successMessage:
      "Historical transaction updated successfully",
  });


// PATCH void historical transaction
export const removeLegacyTransaction = (
  req,
  res
) =>
  executeHistoryOperation({
    req,
    res,

    operation: voidLegacyTransaction,

    successMessage:
      "Historical transaction voided successfully",
  });


// PATCH verify historical history
export const confirmLegacyHistory = (
  req,
  res
) =>
  executeHistoryOperation({
    req,
    res,

    operation:
      verifyLegacyTransactionHistory,

    successMessage:
      "Historical transaction history verified successfully",
  });