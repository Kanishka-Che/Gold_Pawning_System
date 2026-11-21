
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";

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
export const getPawnLoanRenewalHistory = async (req, res) => {
  try {
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
        message: "Renewal history access denied",
      });
    }

    const pawnLoanId = req.params?.id;

    if (
      typeof pawnLoanId !== "string" ||
      !mongoose.isObjectIdOrHexString(pawnLoanId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    // Pagination validation
    const query = req.query ?? {};

    if (
      typeof query !== "object" ||
      Array.isArray(query) ||
      Object.keys(query).some(
        (key) => !["page", "limit"].includes(key)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const parsePositiveInteger = (value, fallback) => {
      if (value === undefined) {
        return fallback;
      }

      if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
      ) {
        return null;
      }

      const parsed = Number(value);

      return Number.isSafeInteger(parsed)
        ? parsed
        : null;
    };

    const page = parsePositiveInteger(query.page, 1);
    const limit = parsePositiveInteger(query.limit, 20);

    if (
      page === null ||
      limit === null ||
      limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination. Page must be positive and limit must be between 1 and 100",
      });
    }

    const loan = await PawnLoan.findById(pawnLoanId)
      .select("_id loanNumber status")
      .lean();

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Pawn loan not found",
      });
    }

    const filter = {
      pawnLoan: loan._id,
    };

    const total = await PawnLoanRenewal.countDocuments(
      filter
    );

    const renewals = await PawnLoanRenewal.find(filter)
      .select(
        "_id pawnLoan previousMaturityDate " +
        "newMaturityDate renewedAt renewedBy " +
        "settingsVersion interestSettled " +
        "renewalFeePaid notes"
      )
      .sort({ renewedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      loan: {
        id: loan._id,
        loanNumber: loan.loanNumber,
        status: loan.status,
      },
      count: renewals.length,
      renewals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "Get Pawn Loan Renewal History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve renewal history",
    });
  }
};


