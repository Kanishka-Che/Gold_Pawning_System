import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import GoldItem from "../models/GoldItem.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  calculatePawnLoanInterestPreview,
} from "./pawnLoanController.js";

import {
  calculateLoanBalanceSummary,
} from "../utils/loanBalanceSummary.js";

import {
  calculateOverdueStatus,
} from "../utils/overdueCalculator.js";

import {
  validateRedemptionEligibility,
  validateRedemptionGoldItems,
} from "../utils/redemptionValidator.js";

const conflictError = (message, code) => {
  const error = new Error(message);

  error.statusCode = 409;
  error.code = code;

  return error;
};

// GET /api/pawn-loans/:id/redemption-preview

export const getPawnLoanRedemptionPreview = async (
  req,
  res
) => {
  let session;

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
        message: "Redemption preview access denied",
      });
    }

    const loanId = req.params?.id;

    if (
      typeof loanId !== "string" ||
      !mongoose.isObjectIdOrHexString(loanId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    // Do not accept client-supplied amounts or dates.
    if (Object.keys(req.query ?? {}).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Unsupported query parameters",
      });
    }

    session = await mongoose.startSession();

    const calculationDate = new Date();

    let redemptionPreview;

    await session.withTransaction(
      async () => {
        // 1. Reuse existing interest calculation.
        const {
          loan,
          payments,
          preview: interestPreview,
        } = await calculatePawnLoanInterestPreview({
          loanId,
          session,
          calculationDate,
        });

        // Load customer and gold item references.
        const loanDetails = await mongoose
          .model("PawnLoan")
          .findById(loanId)
          .select("_id customer status goldItems")
          .session(session)
          .lean();

        if (!loanDetails) {
          const error = new Error(
            "Pawn loan not found"
          );

          error.statusCode = 404;

          throw error;
        }

        // 2. Validate loan eligibility.
        try {
          validateRedemptionEligibility({
            loan: loanDetails,
          });
        } catch (error) {
          throw conflictError(
            error.message,
            "REDEMPTION_NOT_ELIGIBLE"
          );
        }

        // 3. Prevent duplicate redemption.
        const existingRedemption =
          await PawnLoanRedemption.exists({
            pawnLoan: loanDetails._id,
          }).session(session);

        if (existingRedemption) {
          throw conflictError(
            "A redemption record already exists for this loan",
            "REDEMPTION_ALREADY_EXISTS"
          );
        }

        // 4. Load customer information.
        const customer = await Customer.findById(
          loanDetails.customer
        )
          .select("customerCode fullName status")
          .session(session)
          .lean();

        if (!customer) {
          throw conflictError(
            "Customer record not found",
            "REDEMPTION_CUSTOMER_INVALID"
          );
        }

        // 5. Load pledged gold items.
        const goldItems = await GoldItem.find({
          _id: {
            $in: loanDetails.goldItems,
          },
        })
          .select(
            "goldItemCode itemType description " +
            "karat grossWeight deductionWeight " +
            "netWeight status reservedForLoan"
          )
          .session(session)
          .lean();

        // 6. Validate gold item eligibility.
        try {
          validateRedemptionGoldItems({
            loan: loanDetails,
            goldItems,
          });
        } catch (error) {
          throw conflictError(
            error.message,
            "REDEMPTION_GOLD_ITEMS_INVALID"
          );
        }

        // 7. Calculate outstanding balances.
        const balance = calculateLoanBalanceSummary({
          originalPrincipal: loan.principalAmount,

          accruedInterest:
            interestPreview.accruedInterest,

          payments,
        });

        // 8. Calculate overdue information.
        const overdue = calculateOverdueStatus({
          loan,
          calculationDate,
        });

        // 9. Read original redemption settings.
        const redemptionSettings =
          loan.settingsSnapshot?.redemption;

        const hasRedemptionSettings = Boolean(
          redemptionSettings &&
          Object.keys(redemptionSettings).length > 0
        );

        // 10. Preserve original gold item order.
        const goldItemMap = new Map(
          goldItems.map((item) => [
            String(item._id),
            item,
          ])
        );

        const orderedGoldItems =
          loanDetails.goldItems.map((id) => {
            const item = goldItemMap.get(String(id));

            return {
              _id: item._id,

              goldItemCode:
                item.goldItemCode ?? null,

              itemType: item.itemType,

              description: item.description,

              karat: item.karat,

              grossWeight: item.grossWeight,

              deductionWeight: item.deductionWeight,

              netWeight: item.netWeight,

              status: item.status,

              reservationValid: true,
            };
          });

        // 11. Build read-only response.
        redemptionPreview = {
          calculationDate,

          currency: "LKR",

          loan: {
            _id: loan._id,

            loanNumber: loan.loanNumber,

            status: loan.status,

            issueDate: loan.issueDate,

            maturityDate: loan.maturityDate,

            settingsVersion: loan.settingsVersion,
          },

          customer,

          redemptionSettings: {
            configured: hasRedemptionSettings,

            snapshot:
              redemptionSettings ?? null,
          },

          interest: {
            calculationMethod:
              interestPreview.calculationMethod,

            principalCalculationMethod:
              interestPreview.principalCalculationMethod,

            elapsedDays:
              interestPreview.elapsedDays,

            chargedMonths:
              interestPreview.chargedMonths,
          },

          balance,

          overdue: {
            ...overdue,

            penaltyEnabled:
              loan.settingsSnapshot?.overdue
                ?.penaltyEnabled ?? null,

            penaltyRate:
              loan.settingsSnapshot?.overdue
                ?.penaltyRate ?? null,

            penaltyCalculated: false,

            penaltyAmount: null,
          },

          goldItems: orderedGoldItems,

          goldItemCount: orderedGoldItems.length,

          settlement: {
            outstandingPrincipal:
              balance.outstandingPrincipal,

            outstandingInterest:
              balance.outstandingInterest,

            penaltyAmount: null,

            estimatedSettlementExcludingPenalties:
              balance.combinedBalance,

            finalSettlementAmount: null,

            isFinalSettlementAmount: false,
          },

          eligibility: {
            activeLoan: true,

            goldItemReservationsValid: true,

            redemptionSettingsAvailable:
              hasRedemptionSettings,

            existingRedemption: false,

            canPostRedemption: false,

            canReleaseGold: false,
          },

          postingEnabled: false,

          warnings: [
            ...(!hasRedemptionSettings
              ? [
                  "This loan does not contain a confirmed redemption settings snapshot.",
                ]
              : []),

            "Redemption business rules are pending confirmation.",

            "Overdue penalties are excluded from this estimate.",

            "This preview is not a final settlement amount.",

            "No payment has been recorded and no gold items have been released.",
          ],
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

      preview: redemptionPreview,
    });
  } catch (error) {
    if (
      error.statusCode === 404 ||
      error.statusCode === 409
    ) {
      return res.status(error.statusCode).json({
        success: false,

        ...(error.statusCode === 409
          ? {
              code:
                error.code ??
                "REDEMPTION_PREVIEW_CONFLICT",
            }
          : {}),

        message: error.message,
      });
    }

    console.error(
      "Redemption Preview Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to calculate redemption preview",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};