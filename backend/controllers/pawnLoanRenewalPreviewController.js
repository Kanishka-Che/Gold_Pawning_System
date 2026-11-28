import mongoose from "mongoose";

// import {
//   calculatePawnLoanInterestPreview,
// } from "./pawnLoanController.js";

// import {
//   calculateLoanBalanceSummary,
// } from "../utils/loanBalanceSummary.js";

import {
  getLoanFinancialBalance,
} from "../services/loanBalanceService.js";

import {
  validateRenewalEligibility,
} from "../utils/renewalValidator.js";

import {
  calculateOverdueStatus,
} from "../utils/overdueCalculator.js";

import {
  addRenewalMonths,
  isValidRenewalExtension,
} from "../utils/renewalDateCalculator.js";

const requestError = (
  message,
  statusCode = 409
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

const toCents = (value) => {
  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Invalid monetary amount");
  }

  const [whole, fraction = ""] =
    text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (
    cents > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      "Monetary amount exceeds safe range"
    );
  }

  return cents;
};

const fromCents = (cents) => {
  if (
    cents < 0n ||
    cents > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      "Calculated amount exceeds safe range"
    );
  }

  return (
    (cents / 100n).toString() +
    "." +
    (cents % 100n)
      .toString()
      .padStart(2, "0")
  );
};

// GET /api/pawn-loans/:id/renewal-preview
export const previewPawnLoanRenewal = async (
  req,
  res
) => {
  let session;

  try {
    const pawnLoanId = req.params?.id;

    // Authentication
    if (
      !req.user?._id ||
      !mongoose.isObjectIdOrHexString(
        req.user._id
      )
    ) {
      throw requestError(
        "Not authorized",
        401
      );
    }

    // Authorization
    if (
      !["admin", "staff"].includes(
        req.user.role
      ) ||
      req.user.isActive !== true
    ) {
      throw requestError(
        "Renewal preview access denied",
        403
      );
    }

    // Validate loan ID
    if (
      typeof pawnLoanId !== "string" ||
      !mongoose.isObjectIdOrHexString(
        pawnLoanId
      )
    ) {
      throw requestError(
        "Invalid pawn loan ID",
        400
      );
    }

    // Calculation date must come from server
    if (
      Object.keys(req.query ?? {}).length > 0
    ) {
      throw requestError(
        "Unsupported renewal preview parameters",
        400
      );
    }

    session = await mongoose.startSession();

    let renewalPreview;

    await session.withTransaction(
      async () => {
        const calculationDate = new Date();

        const {
  loan,
  balance,
  effectiveMaturityDate,
} = await getLoanFinancialBalance({
  loanId: pawnLoanId,
  session,
  calculationDate,
});

        // Validate renewal eligibility
        try {
          validateRenewalEligibility({
            loan,
          });
        } catch (error) {
          throw requestError(error.message);
        }

        const renewal =
          loan.settingsSnapshot.renewal;

        if (
          !Number.isSafeInteger(
            loan.settingsVersion
          ) ||
          loan.settingsVersion < 1
        ) {
          throw requestError(
            "Invalid loan settings version"
          );
        }

        if (
  !effectiveMaturityDate ||
  !Number.isFinite(
    new Date(
      effectiveMaturityDate
    ).getTime()
  )
) {
  throw requestError(
    "Invalid effective maturity date"
  );
}

const currentMaturityDate =
  new Date(effectiveMaturityDate);

        // Calculate existing outstanding balance

        const principalCents = toCents(
          balance.outstandingPrincipal
        );

        const interestCents = toCents(
          balance.outstandingInterest
        );

        const feeCents = toCents(
          renewal.renewalFee
        );

        if (principalCents <= 0n) {
          throw requestError(
            "This loan has no outstanding principal"
          );
        }

        // Calculate overdue status
       const overdue =
  calculateOverdueStatus({
    loan: {
      ...loan,
      maturityDate: effectiveMaturityDate,
    },
    calculationDate,
  });

        // Candidate 1:
        // Extend from current maturity date
        const maturityBasedDate =
          addRenewalMonths({
            baseDate: currentMaturityDate,

            durationMonths:
              renewal.durationMonths,
          });

        // Candidate 2:
        // Extend from renewal calculation date
        const renewalBasedDate =
          addRenewalMonths({
            baseDate: calculationDate,

            durationMonths:
              renewal.durationMonths,
          });

        // Calculate estimated minimum payment
        const requiredInterestCents =
          renewal.requireInterestSettlement
            ? interestCents
            : 0n;

        const minimumPaymentCents =
          requiredInterestCents + feeCents;

        renewalPreview = {
          pawnLoanId: String(loan._id),

          loanNumber: loan.loanNumber,

          loanStatus: loan.status,

          currency: "LKR",

          calculationDate,

          settingsVersion:
            loan.settingsVersion,

          currentMaturityDate,

          balance,

          overdue,

          renewalRules: {
            enabled: renewal.enabled,

            durationMonths:
              renewal.durationMonths,

            requireInterestSettlement:
              renewal.requireInterestSettlement,

            renewalFee:
              fromCents(feeCents),
          },

         maturityDateOptions: {
  fromCurrentMaturityDate: {
    date: maturityBasedDate,

    validExtension: isValidRenewalExtension({
      proposedDate: maturityBasedDate,
      currentMaturityDate,
      calculationDate,
    }),
  },

  fromRenewalDate: {
    date: renewalBasedDate,

    validExtension: isValidRenewalExtension({
      proposedDate: renewalBasedDate,
      currentMaturityDate,
      calculationDate,
    }),
  },
},

          estimatedPayment: {
            outstandingInterest:
              fromCents(interestCents),

            requiredInterestSettlement:
              fromCents(
                requiredInterestCents
              ),

            renewalFee:
              fromCents(feeCents),

            minimumRequiredPayment:
              fromCents(
                minimumPaymentCents
              ),

            remainingInterestAtMinimumPayment:
              fromCents(
                interestCents -
                  requiredInterestCents
              ),
          },

          penaltyEnabled:
            loan.settingsSnapshot
              ?.overdue?.penaltyEnabled ===
            true,

          includesOverduePenalties: false,

          requiresBusinessRuleConfirmation:
            true,

          isPreview: true,

          isFinalRenewalAmount: false,

          renewalPostingEnabled: false,
        };
      },

      {
        readConcern: {
          level: "snapshot",
        },

        readPreference: "primary",
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      message:
        "Renewal preview calculated successfully",

      preview: renewalPreview,
    });
  } catch (error) {
    if (
      [400, 401, 403, 404, 409].includes(
        error.statusCode
      )
    ) {
      return res
        .status(error.statusCode)
        .json({
          success: false,
          message: error.message,
        });
    }

    console.error(
      "Renewal Preview Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to calculate renewal preview",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};