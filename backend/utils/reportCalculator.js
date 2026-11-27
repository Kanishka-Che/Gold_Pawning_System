import mongoose from "mongoose";

import PawnPayment from "../models/PawnPayment.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  normalizeTransaction,
} from "./dashboardCalculator.js";

const TRANSACTION_SOURCES = [
  {
    model: PawnPayment,
    type: "payment",
    dateField: "paidAt",
    fields:
      "_id pawnLoan paidAt amount " +
      "principalPaid interestPaid",
  },
  {
    model: PawnLoanRenewal,
    type: "renewal",
    dateField: "renewedAt",
    fields:
      "_id pawnLoan renewedAt " +
      "interestSettled renewalFeePaid",
  },
  {
    model: PawnLoanRedemption,
    type: "redemption",
    dateField: "redeemedAt",
    fields:
      "_id pawnLoan redeemedAt " +
      "principalSettled interestSettled " +
      "penaltySettled totalSettled",
  },
];

export const withReportSnapshot = async (
  callback
) => {
  const session = await mongoose.startSession();

  let result;

  try {
    await session.withTransaction(
      async () => {
        result = await callback(session);
      },
      {
        readConcern: {
          level: "snapshot",
        },
        readPreference: "primary",
      }
    );

    return result;
  } finally {
    await session.endSession();
  }
};

export const scanReportTransactions = async ({
  session,
  startDate,
  endDate,
  onTransaction,
}) => {
  for (const source of TRANSACTION_SOURCES) {
    const cursor = source.model
      .find({
        [source.dateField]: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .select(source.fields)
      .session(session)
      .lean()
      .cursor({ batchSize: 200 });

    try {
      for await (const record of cursor) {
        const transaction = normalizeTransaction(
          record,
          source.type
        );

        onTransaction(transaction);
      }
    } finally {
      await cursor.close();
    }
  }
};

export const createTransactionCounts = () => ({
  paymentCount: 0,
  renewalCount: 0,
  redemptionCount: 0,
});

export const addTransactionCount = (
  counts,
  type
) => {
  switch (type) {
    case "payment":
      counts.paymentCount += 1;
      break;

    case "renewal":
      counts.renewalCount += 1;
      break;

    case "redemption":
      counts.redemptionCount += 1;
      break;

    default:
      throw new Error(
        "Unsupported transaction type"
      );
  }
};