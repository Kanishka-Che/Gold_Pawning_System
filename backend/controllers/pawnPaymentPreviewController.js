import mongoose from "mongoose";

import {
  calculatePawnLoanInterestPreview,
} from "./pawnLoanController.js";

import {
  calculateLoanBalanceSummary,
} from "../utils/loanBalanceSummary.js";

import {
  allocatePawnPayment,
} from "../utils/paymentAllocation.js";

import {
  validatePaymentRecord,
} from "../utils/paymentRecordValidator.js";

const toCents = (value) => {
  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Invalid monetary amount");
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount exceeds supported range");
  }

  return cents;
};

const fromCents = (cents) =>
  (cents / 100n).toString() +
  "." +
  (cents % 100n).toString().padStart(2, "0");

const requestError = (message, statusCode = 409) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// POST /api/pawn-payments/preview
export const previewPawnPayment = async (req, res) => {
  let session;

  try {
    const allowedFields = [
      "pawnLoanId",
      "amount",
    ];

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some(
        (field) => !allowedFields.includes(field)
      )
    ) {
      throw requestError(
        "Invalid payment preview request fields",
        400
      );
    }

    const { pawnLoanId, amount } = req.body;

    if (
      typeof pawnLoanId !== "string" ||
      !mongoose.isObjectIdOrHexString(pawnLoanId)
    ) {
      throw requestError("Invalid pawn loan ID", 400);
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw requestError("Invalid payment amount", 400);
    }

    let paymentCents;

    try {
      paymentCents = toCents(amount);
    } catch {
      throw requestError(
        "Invalid payment amount or decimal precision",
        400
      );
    }

    if (!req.user?._id) {
      throw requestError("Not authorized", 401);
    }

    session = await mongoose.startSession();

    let paymentPreview;

    await session.withTransaction(
      async () => {
        const calculationDate = new Date();

        const {
          loan,
          payments,
          preview: interestPreview,
        } = await calculatePawnLoanInterestPreview({
          loanId: pawnLoanId,
          session,
          calculationDate,
        });

        const partialPayment =
          loan.settingsSnapshot?.partialPayment;

        if (!partialPayment) {
          throw requestError(
            "Loan payment settings are missing"
          );
        }

        if (
          typeof partialPayment.enabled !== "boolean" ||
          typeof partialPayment.allowPartialInterest !== "boolean" ||
          typeof partialPayment.allowPartialPrincipal !== "boolean" ||
          !["interest_first", "principal_first"].includes(
            partialPayment.allocationMethod
          )
        ) {
          throw requestError(
            "Unsupported loan payment settings"
          );
        }

        const balance = calculateLoanBalanceSummary({
          originalPrincipal: loan.principalAmount,
          accruedInterest: interestPreview.accruedInterest,
          payments,
        });

        const totalCents = toCents(
          balance.combinedBalance
        );

        if (totalCents <= 0n) {
          throw requestError(
            "This loan has no outstanding balance"
          );
        }

        if (paymentCents > totalCents) {
          throw requestError(
            "Payment exceeds outstanding balance",
            400
          );
        }

        // Full settlement belongs to the redemption module.
        if (paymentCents === totalCents) {
          throw requestError(
            "Full balance settlement must be reviewed through loan redemption"
          );
        }

        if (!partialPayment.enabled) {
          throw requestError(
            "Partial payments are disabled for this loan"
          );
        }

        const minimumCents = toCents(
          partialPayment.minimumAmount
        );

        if (paymentCents < minimumCents) {
          throw requestError(
            `Minimum payment amount is LKR ${fromCents(minimumCents)}`,
            400
          );
        }

        const allocation = allocatePawnPayment({
          paymentAmount: fromCents(paymentCents),
          outstandingPrincipal:
            balance.outstandingPrincipal,
          outstandingInterest:
            balance.outstandingInterest,
          allocationMethod:
            partialPayment.allocationMethod,
        });

        const interestPaidCents = toCents(
          allocation.interestPaid
        );

        const principalPaidCents = toCents(
          allocation.principalPaid
        );

        if (
          !partialPayment.allowPartialInterest &&
          interestPaidCents > 0n &&
          toCents(allocation.remainingInterest) > 0n
        ) {
          throw requestError(
            "Partial interest payments are not allowed"
          );
        }

        if (
          !partialPayment.allowPartialPrincipal &&
          principalPaidCents > 0n &&
          toCents(allocation.remainingPrincipal) > 0n
        ) {
          throw requestError(
            "Partial principal payments are not allowed"
          );
        }

        validatePaymentRecord({
          amount: fromCents(paymentCents),
          interestPaid: allocation.interestPaid,
          principalPaid: allocation.principalPaid,
        });

        const remainingCombinedBalance =
          fromCents(
            toCents(allocation.remainingPrincipal) +
            toCents(allocation.remainingInterest)
          );

        paymentPreview = {
          pawnLoanId: String(loan._id),
          loanNumber: loan.loanNumber,
          loanStatus: loan.status,
          calculationDate,
          currency: "LKR",

          paymentAmount: fromCents(paymentCents),

          balanceBeforePayment: balance,

          allocation: {
            ...allocation,
            remainingCombinedBalance,
          },

          paymentRules: {
            enabled: partialPayment.enabled,
            allowPartialInterest:
              partialPayment.allowPartialInterest,
            allowPartialPrincipal:
              partialPayment.allowPartialPrincipal,
            allocationMethod:
              partialPayment.allocationMethod,
            minimumAmount: fromCents(minimumCents),
          },

          isPreview: true,
          isFinalSettlementAmount: false,
          paymentPostingEnabled: false,
          includesOverduePenalties: false,
        };
      },
      {
        readConcern: { level: "snapshot" },
        readPreference: "primary",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment preview calculated successfully",
      preview: paymentPreview,
    });
  } catch (error) {
    if (
      [400, 401, 403, 404, 409].includes(
        error.statusCode
      )
    ) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Payment Preview Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to calculate payment preview",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};