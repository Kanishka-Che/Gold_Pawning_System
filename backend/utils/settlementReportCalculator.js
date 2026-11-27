import PawnLoanRenewal from "../models/PawnLoanRenewal.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  normalizeTransaction,
  formatMoney,
} from "./dashboardCalculator.js";

const REPORT_SOURCES = {
  renewal: {
    model: PawnLoanRenewal,
    dateField: "renewedAt",
    userField: "renewedBy",

    fields:
      "_id pawnLoan renewedAt renewedBy " +
      "previousMaturityDate newMaturityDate " +
      "settingsVersion interestSettled renewalFeePaid",
  },

  redemption: {
    model: PawnLoanRedemption,
    dateField: "redeemedAt",
    userField: "redeemedBy",

    fields:
      "_id pawnLoan redeemedAt redeemedBy " +
      "settingsVersion principalSettled " +
      "interestSettled penaltySettled " +
      "totalSettled releasedGoldItems",
  },
};

const getReleasedItemCount = (record) => {
  const items = record.releasedGoldItems;

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.some((id) => !id) ||
    new Set(items.map(String)).size !== items.length
  ) {
    throw new Error(
      "Invalid released gold item records"
    );
  }

  return items.length;
};

const validateRenewalDates = (record) => {
  const previous = new Date(
    record.previousMaturityDate
  ).getTime();

  const next = new Date(
    record.newMaturityDate
  ).getTime();

  if (
    !record.previousMaturityDate ||
    !record.newMaturityDate ||
    !Number.isFinite(previous) ||
    !Number.isFinite(next) ||
    next <= previous
  ) {
    throw new Error(
      "Invalid renewal maturity dates"
    );
  }
};

export const buildSettlementReport = async ({
  session,
  type,
  startDate,
  endDate,
  page,
  limit,
}) => {
  const source = REPORT_SOURCES[type];

  if (!source) {
    throw new Error(
      "Unsupported settlement report type"
    );
  }

  const filter = {
    [source.dateField]: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  let total = 0;

  let principalCents = 0n;
  let interestCents = 0n;
  let feeCents = 0n;
  let penaltyCents = 0n;
  let collectedCents = 0n;

  let releasedGoldItemCount = 0;

  const cursor = source.model
    .find(filter)
    .select(source.fields)
    .session(session)
    .lean()
    .cursor({ batchSize: 200 });

  try {
    for await (const record of cursor) {
      const transaction = normalizeTransaction(
        record,
        type
      );

      principalCents += transaction.principal;
      interestCents += transaction.interest;
      feeCents += transaction.fee;
      penaltyCents += transaction.penalty;
      collectedCents += transaction.total;

      if (type === "renewal") {
        validateRenewalDates(record);
      }

      if (type === "redemption") {
        releasedGoldItemCount +=
          getReleasedItemCount(record);
      }

      total += 1;
    }
  } finally {
    await cursor.close();
  }

  const documents = await source.model
    .find(filter)
    .select(source.fields)
    .populate({
      path: "pawnLoan",
      select: "loanNumber customer status",

      populate: {
        path: "customer",
        select: "customerCode fullName",
      },
    })
    .populate(source.userField, "username")
    .sort({
      [source.dateField]: -1,
      _id: -1,
    })
    .skip((page - 1) * limit)
    .limit(limit)
    .session(session)
    .lean();

  const records = documents.map((record) => {
    const transaction = normalizeTransaction(
      record,
      type
    );

    const common = {
      id: record._id,

      pawnLoanId:
        record.pawnLoan?._id ?? null,

      loanNumber:
        record.pawnLoan?.loanNumber ?? null,

      customer:
        record.pawnLoan?.customer ?? null,

      loanStatus:
        record.pawnLoan?.status ?? null,

      settingsVersion:
        record.settingsVersion,

      totalCollected:
        formatMoney(transaction.total),
    };

    if (type === "renewal") {
      return {
        ...common,

        renewedAt: record.renewedAt,

        previousMaturityDate:
          record.previousMaturityDate,

        newMaturityDate:
          record.newMaturityDate,

        interestSettled:
          formatMoney(transaction.interest),

        renewalFeePaid:
          formatMoney(transaction.fee),

        renewedBy:
          record.renewedBy?.username ?? null,
      };
    }

    return {
      ...common,

      redeemedAt: record.redeemedAt,

      principalSettled:
        formatMoney(transaction.principal),

      interestSettled:
        formatMoney(transaction.interest),

      penaltySettled:
        formatMoney(transaction.penalty),

      releasedGoldItemCount:
        getReleasedItemCount(record),

      redeemedBy:
        record.redeemedBy?.username ?? null,
    };
  });

  const summary =
    type === "renewal"
      ? {
          renewalCount: total,

          totalInterestSettled:
            formatMoney(interestCents),

          totalRenewalFees:
            formatMoney(feeCents),

          totalCollected:
            formatMoney(collectedCents),
        }
      : {
          redemptionCount: total,

          totalPrincipalSettled:
            formatMoney(principalCents),

          totalInterestSettled:
            formatMoney(interestCents),

          totalPenaltySettled:
            formatMoney(penaltyCents),

          totalCollected:
            formatMoney(collectedCents),

          releasedGoldItemCount,
        };

  return {
    summary,
    records,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};