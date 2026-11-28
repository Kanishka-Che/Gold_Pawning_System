
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import {
  getIndividualTransactionHistory,
  handleTransactionHistoryError,
} from "../services/individualTransactionHistoryService.js";

import {
  validateRenewalRequest,
  validateRenewalEligibility,
} from "../utils/renewalValidator.js";

// POST /api/pawn-loans/:id/renew
// Safe foundation: actual renewal posting is disabled.
export const renewPawnLoan = async (req, res) => {
  try {
    // Defense in depth: authentication and authorization
    if (
      !req.user?._id ||
      !mongoose.isObjectIdOrHexString(req.user._id)
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    if (
      !["admin", "staff"].includes(req.user.role) ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "Renewal access denied",
      });
    }

    const allowedFields = ["idempotencyKey", "notes"];

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some(
        (field) => !allowedFields.includes(field)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal request fields",
      });
    }

    let validatedRequest;

    try {
      validatedRequest = validateRenewalRequest({
        pawnLoanId: req.params?.id,
        idempotencyKey: req.body.idempotencyKey,
        notes: req.body.notes ?? "",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const loan = await PawnLoan.findById(
      validatedRequest.pawnLoanId
    )
      .select("_id status settingsSnapshot.renewal")
      .lean();

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Pawn loan not found",
      });
    }

    try {
      validateRenewalEligibility({ loan });
    } catch {
      return res.status(409).json({
        success: false,
        code: "RENEWAL_NOT_ELIGIBLE",
        message:
          "This pawn loan is not eligible for renewal",
      });
    }

    // Financial rules are not confirmed yet.
    // Do not update maturityDate or create renewal records.
    return res.status(501).json({
      success: false,
      code: "RENEWAL_POSTING_DISABLED",
      message:
        "Loan renewal processing is not implemented yet",
    });
  } catch (error) {
    console.error("Renew Pawn Loan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process loan renewal request",
    });
  }
};



/**
 * GET /api/pawn-loans/:id/renewals?page=1&limit=20
 *
 * Read-only, paginated renewal history.
 */

// GET /api/pawn-loans/:id/renewals
export const getPawnLoanRenewalHistory = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const history =
      await getIndividualTransactionHistory({
        req,
        transactionType: "renewal",
      });

    const renewals = history.transactions.map(
      (transaction) => ({
        _id: transaction.id,

        pawnLoan: history.loan.id,

        previousMaturityDate:
          transaction.previousMaturityDate,

        newMaturityDate:
          transaction.newMaturityDate,

        renewedAt: transaction.transactionDate,

        renewedBy: transaction.recordedBy,

        settingsVersion:
          transaction.settingsVersion,

        interestSettled:
          transaction.interestSettled,

        renewalFeePaid:
          transaction.renewalFeePaid,

        notes: transaction.notes ?? "",

        transactionSource:
          transaction.transactionSource,

        isHistorical: transaction.isHistorical,

        ...(transaction.isHistorical
          ? {
              importedAt: transaction.importedAt,
              importedBy: transaction.importedBy,
              sequenceNumber:
                transaction.sequenceNumber,
              historicalReference:
                transaction.reference,
            }
          : {}),
      })
    );

    return res.status(200).json({
      success: true,

      loan: history.loan,

      count: renewals.length,

      renewals,

      pagination: history.pagination,

      historySummary: history.historySummary,
    });
  } catch (error) {
    return handleTransactionHistoryError(
      res,
      error
    );
  }
};



