import mongoose from "mongoose";

import PawnLoanRedemption from
  "../models/PawnLoanRedemption.js";

// GET /api/pawn-redemptions/:id

export const getPawnRedemptionById = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const redemptionId = req.params?.id;

    // Validate redemption ID
    if (
      typeof redemptionId !== "string" ||
      !mongoose.isObjectIdOrHexString(
        redemptionId
      )
    ) {
      return res.status(400).json({
        success: false,

        message: "Invalid redemption ID",
      });
    }

    // Reject unsupported query parameters
    if (
      Object.keys(req.query ?? {}).length > 0
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Unsupported query parameters",
      });
    }

    // Load existing redemption record
    const redemption =
      await PawnLoanRedemption
        .findById(redemptionId)
        .select(
          "pawnLoan redeemedAt redeemedBy " +
          "settingsVersion principalSettled " +
          "interestSettled penaltySettled " +
          "totalSettled releasedGoldItems notes"
        )
        .populate({
          path: "pawnLoan",

          select:
            "loanNumber customer status " +
            "issueDate maturityDate",

          populate: {
            path: "customer",

            select:
              "customerCode fullName",
          },
        })
        .populate(
          "redeemedBy",
          "username"
        )
        .populate({
          path: "releasedGoldItems",

          select:
            "goldItemCode itemType description " +
            "karat grossWeight deductionWeight " +
            "netWeight status",
        })
        .lean();

    if (!redemption) {
      return res.status(404).json({
        success: false,

        message:
          "Redemption record not found",
      });
    }

    return res.status(200).json({
      success: true,

      currency: "LKR",

      redemption,
    });
  } catch (error) {
    console.error(
      "Get Pawn Redemption Details Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to load redemption details",
    });
  }
};