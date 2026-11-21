
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

import {
  calculateOverdueStatus,
} from "../utils/overdueCalculator.js";

/**
 * GET /api/pawn-loans/overdue?page=1&limit=20
 *
 * Read-only overdue loan list.
 *
 * Only active loans are evaluated.
 * Pagination is applied after overdue classification.
 * No loan status or financial records are modified.
 */
export const getOverduePawnLoans = async (req, res) => {
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

    // Authorization
    if (
      !["admin", "staff"].includes(req.user.role) ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "Overdue loan access denied",
      });
    }

    const query = req.query ?? {};

    // Allow only pagination parameters
    if (
      typeof query !== "object" ||
      Array.isArray(query) ||
      Object.keys(query).some(
        (key) => !["page", "limit"].includes(key)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
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

    
    // One calculation date for the entire request.
    const calculationDate = new Date();

    // Sri Lanka calendar-day start.
    // Loans maturing today must not be treated
    // as overdue merely because their timestamp
    // is earlier than the current clock time.
    const SRI_LANKA_OFFSET_MS = 330 * 60 * 1000;

    const sriLankaNow = new Date(
      calculationDate.getTime() + SRI_LANKA_OFFSET_MS
    );

    const todayStartUtcMs =
      Date.UTC(
        sriLankaNow.getUTCFullYear(),
        sriLankaNow.getUTCMonth(),
        sriLankaNow.getUTCDate()
      ) - SRI_LANKA_OFFSET_MS;

    const todayStartUtc = new Date(todayStartUtcMs);

    // Only fetch active loans with maturity dates
    // before the current Sri Lanka calendar day.
    const cursor = PawnLoan.find({
      status: "active",
      maturityDate: { $lt: todayStartUtc },
    })
      .select(
        "_id loanNumber customer principalAmount " +
        "currency issueDate maturityDate status " +
        "settingsSnapshot.overdue"
      )
      .sort({ maturityDate: 1, _id: 1 })
      .lean()
      .cursor({ batchSize: 200 });

    const overdueLoans = [];
    const loansWithInvalidSettings = [];

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    let total = 0;

    for await (const loan of cursor) {
      try {
        const overdue = calculateOverdueStatus({
          loan,
          calculationDate,
        });

        if (overdue.overdueStatus !== "overdue") {
          continue;
        }

        // Keep only the requested page in memory.
        if (total >= startIndex && total < endIndex) {
          overdueLoans.push({
            id: loan._id,
            loanNumber: loan.loanNumber,
            customerId: loan.customer,
            principalAmount: loan.principalAmount,
            currency: loan.currency,
            issueDate: loan.issueDate,
            maturityDate: loan.maturityDate,
            ...overdue,
          });
        }

        total += 1;
      } catch {
        // Invalid business settings must never
        // silently become an overdue classification.
        loansWithInvalidSettings.push({
          id: loan._id,
          loanNumber: loan.loanNumber,
        });
      }
    }

    
    return res.status(200).json({
      success: true,
      calculationDate,
      count: overdueLoans.length,
      pawnLoans: overdueLoans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      dataQuality: {
        invalidSettingsCount:
          loansWithInvalidSettings.length,
        loansWithInvalidSettings,
      },
    });

  } catch (error) {
    console.error("Get Overdue Pawn Loans Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve overdue pawn loans",
    });
  }
};
