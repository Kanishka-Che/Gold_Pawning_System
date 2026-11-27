import mongoose from "mongoose";

import PawnLoanRenewal from
  "../models/PawnLoanRenewal.js";

// GET /api/pawn-renewals/:id
export const getPawnRenewalById = async (
  req,
  res
) => {
  try {
    const renewalId = req.params?.id;

    if (
      typeof renewalId !== "string" ||
      !mongoose.isObjectIdOrHexString(renewalId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal ID",
      });
    }

    if (Object.keys(req.query ?? {}).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Unsupported query parameters",
      });
    }

    const renewal = await PawnLoanRenewal
      .findById(renewalId)
      .select(
        "pawnLoan previousMaturityDate " +
        "newMaturityDate renewedAt renewedBy " +
        "settingsVersion interestSettled " +
        "renewalFeePaid notes"
      )
      .populate({
        path: "pawnLoan",
        select: "loanNumber customer status",
        populate: {
          path: "customer",
          select: "customerCode fullName",
        },
      })
      .populate("renewedBy", "username")
      .lean();

    if (!renewal) {
      return res.status(404).json({
        success: false,
        message: "Renewal record not found",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      renewal,
    });
  } catch (error) {
    console.error(
      "Get Pawn Renewal Details Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load renewal details",
    });
  }
};