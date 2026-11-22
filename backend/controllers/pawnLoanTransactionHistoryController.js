
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

// GET /api/pawn-loans/:id/transactions?page=1&limit=20
// Read-only combined financial transaction history.
export const getPawnLoanTransactionHistory = async (req, res) => {
  try {
    // Defense-in-depth authentication.
    if (
      !req.user?._id ||
      !mongoose.isObjectIdOrHexString(req.user._id)
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    // Defense-in-depth authorization.
    if (
      !["admin", "staff"].includes(req.user.role) ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "Transaction history access denied",
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
      if (value === undefined) return fallback;

      if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
      ) {
        return null;
      }

      const parsed = Number(value);

      return Number.isSafeInteger(parsed) ? parsed : null;
    };

    
const page = parsePositiveInteger(query.page, 1);
const limit = parsePositiveInteger(query.limit, 20);

const MAX_HISTORY_SCAN = 10000;

if (
  page === null ||
  limit === null ||
  limit > 100 ||
  !Number.isSafeInteger(page * limit) ||
  page * limit > MAX_HISTORY_SCAN
) {
  return res.status(400).json({
    success: false,
    message: "Invalid pagination parameters",
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

    const filter = { pawnLoan: loan._id };

    // Retrieve at most page * limit records from each source.
    // This is sufficient to calculate the requested merged page.
    const take = page * limit;

    const [
      paymentTotal,
      renewalTotal,
      redemptionTotal,
      payments,
      renewals,
      redemptions,
    ] = await Promise.all([
      PawnPayment.countDocuments(filter),
      PawnLoanRenewal.countDocuments(filter),
      PawnLoanRedemption.countDocuments(filter),

      PawnPayment.find(filter)
        .select(
          "_id amount interestPaid principalPaid " +
          "paymentMethod paidAt recordedBy reference"
        )
        .sort({ paidAt: -1, _id: -1 })
        .limit(take)
        .lean(),

      PawnLoanRenewal.find(filter)
        .select(
          "_id renewedAt renewedBy interestSettled " +
          "renewalFeePaid previousMaturityDate " +
          "newMaturityDate settingsVersion"
        )
        .sort({ renewedAt: -1, _id: -1 })
        .limit(take)
        .lean(),

      PawnLoanRedemption.find(filter)
        .select(
          "_id redeemedAt redeemedBy principalSettled " +
          "interestSettled penaltySettled totalSettled " +
          "settingsVersion"
        )
        .sort({ redeemedAt: -1, _id: -1 })
        .limit(take)
        .lean(),
    ]);

    const transactions = [
      ...payments.map((payment) => ({
        id: payment._id,
        type: "payment",
        transactionDate: payment.paidAt,
        amount: payment.amount,
        interestPaid: payment.interestPaid,
        principalPaid: payment.principalPaid,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        recordedBy: payment.recordedBy,
      })),

      ...renewals.map((renewal) => ({
        id: renewal._id,
        type: "renewal",
        transactionDate: renewal.renewedAt,
        amount:
          Math.round(
            (renewal.interestSettled + renewal.renewalFeePaid) * 100
          ) / 100,
        interestSettled: renewal.interestSettled,
        renewalFeePaid: renewal.renewalFeePaid,
        previousMaturityDate: renewal.previousMaturityDate,
        newMaturityDate: renewal.newMaturityDate,
        settingsVersion: renewal.settingsVersion,
        recordedBy: renewal.renewedBy,
      })),

      ...redemptions.map((redemption) => ({
        id: redemption._id,
        type: "redemption",
        transactionDate: redemption.redeemedAt,
        amount: redemption.totalSettled,
        principalSettled: redemption.principalSettled,
        interestSettled: redemption.interestSettled,
        penaltySettled: redemption.penaltySettled,
        settingsVersion: redemption.settingsVersion,
        recordedBy: redemption.redeemedBy,
      })),
    ];

    const typeOrder = {
      payment: 0,
      renewal: 1,
      redemption: 2,
    };

    transactions.sort((a, b) => {
      const dateDifference =
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime();

      if (dateDifference !== 0) return dateDifference;

      const typeDifference =
        typeOrder[a.type] - typeOrder[b.type];

      if (typeDifference !== 0) return typeDifference;

      return String(b.id).localeCompare(String(a.id));
    });

    const total =
      paymentTotal + renewalTotal + redemptionTotal;

    const startIndex = (page - 1) * limit;

    const paginatedTransactions = transactions.slice(
      startIndex,
      startIndex + limit
    );

    return res.status(200).json({
      success: true,
      loan: {
        id: loan._id,
        loanNumber: loan.loanNumber,
        status: loan.status,
      },
      count: paginatedTransactions.length,
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "Get Pawn Loan Transaction History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transaction history",
    });
  }
};
