
import mongoose from "mongoose";

import {
  checkSecurePaymentReplay,
} from "../services/securePaymentReplayService.js";

import {
  formatPaymentReplayResponse,
} from "../utils/paymentReplayResponse.js";

// POST /api/pawn-payments
export const createPawnPayment = async (req, res) => {
  try {
    const {
      pawnLoanId,
      amount,
      paymentMethod,
      reference = "",
      idempotencyKey,
    } = req.body ?? {};

    // Only accept expected fields
    const allowedFields = [
      "pawnLoanId",
      "amount",
      "paymentMethod",
      "reference",
      "idempotencyKey",
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
        message: "Invalid payment request fields",
      });
    }

    // Validate pawn loan ID
    if (
      typeof pawnLoanId !== "string" ||
      !mongoose.isObjectIdOrHexString(pawnLoanId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    // Validate payment amount
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const amountCents = Math.round(amount * 100);

    if (
      !Number.isSafeInteger(amountCents) ||
      Math.abs(amount - amountCents / 100) > 1e-8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must have at most two decimal places",
      });
    }

    // Validate payment method
    if (
      !["cash", "bank_transfer"].includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // Validate reference
    if (
      typeof reference !== "string" ||
      reference.length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment reference",
      });
    }

    // Validate idempotency key
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 100 ||
      !/^[A-Za-z0-9_-]+$/.test(idempotencyKey)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment idempotency key",
      });
    }

    // Authentication must come from protect middleware.
    // Never trust recordedBy from the frontend.
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    // Read-only secure replay check
    const result = await checkSecurePaymentReplay({
      idempotencyKey,
      request: {
        pawnLoanId,
        amount,
        paymentMethod,
        reference,
      },
      user: req.user,
    });

    // Convert decision to a safe HTTP response
    const response = formatPaymentReplayResponse(result);

    return res.status(response.statusCode).json(response.body);
  } catch (error) {
    // Expected validation / access errors
    if (
      [400, 403, 404].includes(error.statusCode)
    ) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create Pawn Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process payment request",
    });
  }
};
