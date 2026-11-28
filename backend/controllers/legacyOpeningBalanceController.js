import mongoose from "mongoose";

import {
  getLegacyOpeningBalanceData,
  saveLegacyOpeningBalance,
  verifyLegacyOpeningBalance,
} from "../services/legacyOpeningBalanceService.js";


// Run operation inside database transaction
const runOpeningBalanceTransaction = async (
  operation
) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(
      async () => {
        result = await operation(session);
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

    return result;

  } finally {
    await session.endSession();
  }
};


// Shared error handler
const handleOpeningBalanceError = (
  res,
  error
) => {
  if (
    [400, 403, 404, 409].includes(
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
    error.name === "VersionError" ||
    error.hasErrorLabel?.(
      "TransientTransactionError"
    )
  ) {
    return res.status(409).json({
      success: false,

      message:
        "Opening balance was modified concurrently. Reload and try again.",
    });
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,

      message:
        "Invalid opening balance information",
    });
  }

  console.error(
    "Legacy Opening Balance Error:",
    error.name,
    error.code
  );

  return res.status(500).json({
    success: false,

    message:
      "Failed to process opening balance",
  });
};


// GET /api/pawn-loans/legacy/:id/opening-balance
export const getLegacyOpeningBalance = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const data =
      await getLegacyOpeningBalanceData({
        req,

        loanId: req.params.id,
      });

    return res.status(200).json({
      success: true,

      data,
    });

  } catch (error) {
    return handleOpeningBalanceError(
      res,
      error
    );
  }
};


// PUT /api/pawn-loans/legacy/:id/opening-balance
export const updateLegacyOpeningBalance = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const result =
      await runOpeningBalanceTransaction(
        (session) =>
          saveLegacyOpeningBalance({
            req,

            loanId: req.params.id,

            input: req.body,

            session,
          })
      );

    return res.status(200).json({
      success: true,

      changed: result.changed,

      message: result.changed
        ? "Opening balance saved successfully"
        : "No opening balance changes detected",

      data: result.data,
    });

  } catch (error) {
    return handleOpeningBalanceError(
      res,
      error
    );
  }
};


// PATCH /api/pawn-loans/legacy/:id/opening-balance/verify
export const confirmLegacyOpeningBalance = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const data =
      await runOpeningBalanceTransaction(
        (session) =>
          verifyLegacyOpeningBalance({
            req,

            loanId: req.params.id,

            input: req.body,

            session,
          })
      );

    return res.status(200).json({
      success: true,

      message:
        "Opening balance verified successfully",

      data,
    });

  } catch (error) {
    return handleOpeningBalanceError(
      res,
      error
    );
  }
};