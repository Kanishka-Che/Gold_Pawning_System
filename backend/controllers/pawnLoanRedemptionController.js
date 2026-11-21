
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import GoldItem from "../models/GoldItem.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  validateRedemptionRequest,
  validateRedemptionEligibility,
  validateRedemptionGoldItems,
} from "../utils/redemptionValidator.js";

/**
 * POST /api/pawn-loans/:id/redeem
 *
 * Safe foundation only.
 * Actual redemption posting and gold release are disabled.
 */
export const redeemPawnLoan = async (req, res) => {
  try {
    // Authentication defense in depth
    if (
      !req.user?._id ||
      !mongoose.isObjectIdOrHexString(req.user._id)
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    // Authorization defense in depth
    if (
      !["admin", "staff"].includes(req.user.role) ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "Redemption access denied",
      });
    }

    // Prevent clients from supplying financial amounts
    // or directly changing gold release information.
    const allowedFields = [
      "idempotencyKey",
      "notes",
    ];

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
        message: "Invalid redemption request fields",
      });
    }

    let validatedRequest;

    try {
      validatedRequest = validateRedemptionRequest({
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

    // Read-only loan lookup
    const loan = await PawnLoan.findById(
      validatedRequest.pawnLoanId
    )
      .select("_id status goldItems")
      .lean();

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Pawn loan not found",
      });
    }

    try {
      validateRedemptionEligibility({ loan });
    } catch {
      return res.status(409).json({
        success: false,
        code: "REDEMPTION_NOT_ELIGIBLE",
        message:
          "This pawn loan is not eligible for redemption",
      });
    }

    // Read-only gold item lookup
    const goldItems = await GoldItem.find({
      _id: { $in: loan.goldItems },
    })
      .select("_id status reservedForLoan")
      .lean();

    try {
      validateRedemptionGoldItems({
        loan,
        goldItems,
      });
    } catch {
      return res.status(409).json({
        success: false,
        code: "REDEMPTION_GOLD_ITEMS_INVALID",
        message:
          "Gold items are not eligible for release",
      });
    }

    // Financial settlement rules are not confirmed.
    // Do not create redemption records.
    // Do not update PawnLoan status or redeemedAt.
    // Do not change GoldItem status or reservation.
    return res.status(501).json({
      success: false,
      code: "REDEMPTION_POSTING_DISABLED",
      message:
        "Loan redemption and gold release are not implemented yet",
    });
  } catch (error) {
    console.error("Redeem Pawn Loan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process pawn loan redemption",
    });
  }
};



/**
 * GET /api/pawn-loans/:id/redemptions?page=1&limit=20
 *
 * Read-only redemption history.
 * One redemption record is allowed per pawn loan.
 */
export const getPawnLoanRedemptionHistory = async (req, res) => {
  try {
    // Authentication
    if (
      !req.user?._id ||
      !mongoose.isObjectIdOrHexString(req.user._id)
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    // Authorization
    if (
      !["admin", "staff"].includes(req.user.role) ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "Redemption history access denied",
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

    // Validate pagination parameters
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

    // Verify pawn loan exists
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

    const total =
      await PawnLoanRedemption.countDocuments(filter);

    const redemptions = await PawnLoanRedemption.find(filter)
      .select(
        "_id pawnLoan redeemedAt redeemedBy " +
        "settingsVersion principalSettled " +
        "interestSettled penaltySettled " +
        "totalSettled releasedGoldItems notes"
      )
      .sort({ redeemedAt: -1, _id: -1 })
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
      count: redemptions.length,
      redemptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "Get Pawn Loan Redemption History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve redemption history",
    });
  }
};
