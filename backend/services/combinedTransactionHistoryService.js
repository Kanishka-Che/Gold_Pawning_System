
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";
import LegacyPawnTransaction from "../models/LegacyPawnTransaction.js";
import {
  createPaymentHistoryAccumulator,
} from "../utils/paymentHistorySummary.js";

import {
  normalizeLegacyTransaction,
  normalizeLivePayment,
  normalizeLiveRenewal,
  normalizeLiveRedemption,
  sortCombinedTransactions,
} from "../utils/combinedTransactionHistory.js";


const MAX_PAGE_SIZE = 100;
const MAX_HISTORY_SCAN = 10000;


export class TransactionHistoryError extends Error {
  constructor(message, statusCode = 409) {
    super(message);

    this.name = "TransactionHistoryError";
    this.statusCode = statusCode;
  }
}


export const getCombinedTransactionHistory = async ({
  req,
  loanId,
  page = 1,
  limit = 20,
  transactionType = "all",
  session,
}) => {
  // 1. Authentication
  if (
    !req.user?._id ||
    !mongoose.isObjectIdOrHexString(
      req.user._id
    )
  ) {
    throw new TransactionHistoryError(
      "Not authorized",
      401
    );
  }

  // 2. Authorization
  if (
    !["admin", "staff"].includes(
      req.user.role
    ) ||
    req.user.isActive !== true
  ) {
    throw new TransactionHistoryError(
      "Transaction history access denied",
      403
    );
  }

  // 3. Require consistent database snapshot
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Active database transaction is required"
    );
  }

  // 4. Validate loan ID
  if (
    typeof loanId !== "string" ||
    !mongoose.isObjectIdOrHexString(loanId)
  ) {
    throw new TransactionHistoryError(
      "Invalid pawn loan ID",
      400
    );
  }

  // 5. Validate pagination
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE ||
    !Number.isSafeInteger(page * limit) ||
    page * limit > MAX_HISTORY_SCAN
  ) {
    throw new TransactionHistoryError(
      "Invalid pagination parameters",
      400
    );
  }

  if (
  !["all", "payment", "renewal", "redemption"].includes(
    transactionType
  )
) {
  throw new TransactionHistoryError(
    "Invalid transaction history type",
    400
  );
}

const includePayments =
  transactionType === "all" ||
  transactionType === "payment";

const includeRenewals =
  transactionType === "all" ||
  transactionType === "renewal";

const includeRedemptions =
  transactionType === "all" ||
  transactionType === "redemption";

  // 6. Load pawn loan
  const loan = await PawnLoan.findById(loanId)
    .select(
      "_id loanNumber status recordSource " +
      "legacyHistoryMode legacyMigrationStatus"
    )
    .session(session)
    .lean();

  if (!loan) {
    throw new TransactionHistoryError(
      "Pawn loan not found",
      404
    );
  }

  const recordSource =
    loan.recordSource ?? "new";

  if (
    !["new", "legacy"].includes(recordSource)
  ) {
    throw new TransactionHistoryError(
      "Unsupported loan record source"
    );
  }

  // 7. Prevent access to incomplete migration data
  if (
    recordSource === "legacy" &&
    (
      loan.legacyMigrationStatus !== "completed" ||
      !["active", "redeemed", "closed"].includes(
        loan.status
      )
    )
  ) {
    throw new TransactionHistoryError(
      "Legacy migration must be completed before " +
      "accessing operational transaction history"
    );
  }

  if (
    recordSource === "legacy" &&
    !["full_history", "opening_balance"].includes(
      loan.legacyHistoryMode
    )
  ) {
    throw new TransactionHistoryError(
      "Invalid legacy migration mode"
    );
  }

  const filter = {
    pawnLoan: loan._id,
  };

  const take = page * limit;

 // 8. Load selected live transaction counts
const paymentTotal = includePayments
  ? await PawnPayment.countDocuments(filter)
      .session(session)
  : 0;

const renewalTotal = includeRenewals
  ? await PawnLoanRenewal.countDocuments(filter)
      .session(session)
  : 0;

const redemptionTotal = includeRedemptions
  ? await PawnLoanRedemption.countDocuments(filter)
      .session(session)
  : 0;


// 9. Load live payment history
let payments = [];

if (includePayments) {
  const paymentQuery = PawnPayment.find(filter)
    .select(
      "_id amount interestPaid principalPaid " +
      "paymentMethod paidAt recordedBy reference"
    )
    .sort({ paidAt: -1, _id: -1 })
    .limit(take)
    .session(session);

  if (transactionType === "payment") {
    paymentQuery.populate({
      path: "recordedBy",
      select: "username",
      options: { session },
    });
  }

  payments = await paymentQuery.lean();
}


// 10. Load live renewal history
const renewals = includeRenewals
  ? await PawnLoanRenewal.find(filter)
      .select(
        "_id renewedAt renewedBy interestSettled " +
        "renewalFeePaid previousMaturityDate " +
        "newMaturityDate settingsVersion notes"
      )
      .sort({ renewedAt: -1, _id: -1 })
      .limit(take)
      .session(session)
      .lean()
  : [];

// 11. Load live redemption history
const redemptions = includeRedemptions
  ? await PawnLoanRedemption.find(filter)
      .select(
        "_id redeemedAt redeemedBy " +
        "principalSettled interestSettled " +
        "penaltySettled totalSettled settingsVersion"
      )
      .sort({ redeemedAt: -1, _id: -1 })
      .limit(take)
      .session(session)
      .lean()
  : [];

  // 12. Historical transaction integration
  let historicalTransactions = [];
  let historicalTotal = 0;

  if (
    recordSource === "legacy" &&
    loan.legacyHistoryMode === "full_history"
  ) {
    // Completed migrations must not contain
    // unverified financial transactions.
    const pendingTransaction =
      await LegacyPawnTransaction.exists({
        ...filter,
        status: "pending",
      }).session(session);

    if (pendingTransaction) {
      throw new TransactionHistoryError(
        "Unverified historical transactions exist"
      );
    }

    const historicalFilter = {
  ...filter,
  status: "verified",
};

if (transactionType !== "all") {
  historicalFilter.transactionType =
    transactionType;
}

    historicalTotal =
      await LegacyPawnTransaction.countDocuments(
        historicalFilter
      ).session(session);

    historicalTransactions =
      await LegacyPawnTransaction.find(
        historicalFilter
      )
        .select(
  "_id transactionType transactionDate " +
  "sequenceNumber amount principalPaid " +
  "interestPaid renewalFeePaid paymentMethod " +
  "historicalReference previousMaturityDate " +
  "newMaturityDate importedAt importedBy status notes"
)
        .sort({
          transactionDate: -1,
          sequenceNumber: -1,
          _id: -1,
        })
        .limit(take)
        .session(session)
        .lean();
  } else {
    // Opening balance and new loans must not
    // contain historical transaction records.
    const unexpectedHistory =
      await LegacyPawnTransaction.exists(filter)
        .session(session);

    if (unexpectedHistory) {
      throw new TransactionHistoryError(
        "Unexpected historical transactions exist"
      );
    }
  }


let paymentSummary = null;

if (transactionType === "payment") {
  const accumulator =
    createPaymentHistoryAccumulator();

  // Include every live payment, not only
  // the current pagination window.
  const liveCursor = PawnPayment.find(filter)
    .select("amount principalPaid interestPaid")
    .session(session)
    .lean()
    .cursor();

  try {
    for await (const payment of liveCursor) {
      accumulator.add(payment);
    }
  } finally {
    await liveCursor.close();
  }

  // Include verified historical payments only.
  if (
    recordSource === "legacy" &&
    loan.legacyHistoryMode === "full_history"
  ) {
    const historicalCursor =
      LegacyPawnTransaction.find({
        ...filter,
        status: "verified",
        transactionType: "payment",
      })
        .select(
          "amount principalPaid interestPaid"
        )
        .session(session)
        .lean()
        .cursor();

    try {
      for await (
        const payment of historicalCursor
      ) {
        accumulator.add(payment);
      }
    } finally {
      await historicalCursor.close();
    }
  }

  paymentSummary = accumulator.getSummary();
}



  // 13. Normalize transaction records
  const combinedTransactions = [
    ...payments.map(normalizeLivePayment),

    ...renewals.map(normalizeLiveRenewal),

    ...redemptions.map(normalizeLiveRedemption),

    ...historicalTransactions.map(
      normalizeLegacyTransaction
    ),
  ];

  // 14. Sort combined history
  const sortedTransactions =
    sortCombinedTransactions(
      combinedTransactions
    );

  // 15. Apply combined pagination
  const startIndex = (page - 1) * limit;

  const transactions =
    sortedTransactions.slice(
      startIndex,
      startIndex + limit
    );

  const liveTotal =
    paymentTotal +
    renewalTotal +
    redemptionTotal;

  const total =
    liveTotal + historicalTotal;

  // 16. Return read-only response
  return {

    transactionType,

paymentSummary,

    loan: {
      id: loan._id,

      loanNumber: loan.loanNumber,

      status: loan.status,

      recordSource,

      legacyHistoryMode:
        loan.legacyHistoryMode ?? null,
    },

    count: transactions.length,

    transactions,

    historySummary: {
      liveTransactionCount: liveTotal,

      historicalTransactionCount:
        historicalTotal,

      totalTransactionCount: total,

      includesOpeningBalanceAsTransaction:
        false,
    },

    pagination: {
      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),
    },
  };
};
