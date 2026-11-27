
import mongoose from "mongoose";
import PawnPayment from "../models/PawnPayment.js";

// GET /api/pawn-payments/:id
export const getPawnPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
      });
    }

    const payment = await PawnPayment.findById(id)
      .select(
        "pawnLoan amount interestPaid principalPaid " +
        "paymentMethod paidAt recordedBy reference"
      )
      .populate({
        path: "pawnLoan",
        select: "loanNumber customer status",
        populate: {
          path: "customer",
          select: "customerCode fullName",
        },
      })
      .populate("recordedBy", "username")
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Get Pawn Payment Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load payment details",
    });
  }
};
