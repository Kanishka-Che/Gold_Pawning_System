import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

import {
  createLegacyPawnLoanDraft,
} from "../services/legacyPawnLoanService.js";


// POST /api/pawn-loans/legacy
export const createLegacyPawnLoan = async (
  req,
  res
) => {
  let session;

  res.set("Cache-Control", "no-store");

  try {
    session = await mongoose.startSession();

    let createdLoan;

    await session.withTransaction(
      async () => {
        createdLoan =
          await createLegacyPawnLoanDraft({
            req,
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

    return res.status(201).json({
      success: true,

      message:
        "Legacy pawn loan draft created successfully",

      pawnLoan: createdLoan,

      requiresMigrationVerification: true,

      canActivate: false,
    });

  } catch (error) {
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

    if (error.code === 11000) {
      const duplicateTicket =
        error.keyPattern?.legacyTicketNumber === 1;

      return res.status(409).json({
        success: false,

        message: duplicateTicket
          ? "Original pawn ticket number already exists"
          : "Duplicate loan record detected",
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
          "Legacy loan creation conflict. Reload and try again.",
      });
    }

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid legacy pawn loan information",
      });
    }

    console.error(
      "Create Legacy Pawn Loan Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to create legacy pawn loan",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};


// PATCH /api/pawn-loans/legacy/:id/activate
export const activateLegacyPawnLoan = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    if (
      !req.user?._id ||
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Only administrators can activate legacy loans",
      });
    }

    if (
      !mongoose.isObjectIdOrHexString(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    const loan = await PawnLoan.findOne({
      _id: req.params.id,
      recordSource: "legacy",
    })
      .select(
        "_id status legacyMigrationStatus"
      )
      .lean();

    if (!loan) {
      return res.status(404).json({
        success: false,

        message:
          "Legacy pawn loan not found",
      });
    }

    if (loan.status !== "draft") {
      return res.status(409).json({
        success: false,

        message:
          "Only draft legacy loans can be activated",
      });
    }

    // Activation remains disabled until migration,
    // balance verification and reporting are ready.
    return res.status(409).json({
      success: false,

      code: "LEGACY_ACTIVATION_DISABLED",

      message:
        "Legacy activation is not available until migration verification is completed",
    });

  } catch (error) {
    console.error(
      "Activate Legacy Pawn Loan Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to validate legacy loan activation",
    });
  }
};