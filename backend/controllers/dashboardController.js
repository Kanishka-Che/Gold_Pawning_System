import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import GoldItem from "../models/GoldItem.js";
import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  calculateOverdueStatus,
} from "../utils/overdueCalculator.js";

import {
  calculateOutstandingPrincipal,
} from "../utils/outstandingBalance.js";

import {
  toCents,
  formatMoney,
  getSriLankaDateParts,
  getDashboardPeriods,
  createFinancialTotals,
  normalizeTransaction,
  addTransaction,
  serializeFinancialTotals,
} from "../utils/dashboardCalculator.js";

const UPCOMING_DAYS = 7;

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
      "_id pawnLoan redeemedAt principalSettled " +
      "interestSettled penaltySettled totalSettled",
  },
];

// Consistent database read snapshot.
const withReadSnapshot = async (callback) => {
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

const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validateQuery = (req, allowedKeys = []) => {
  const params = new URLSearchParams(
    req.originalUrl.split("?")[1] || ""
  );

  for (const key of params.keys()) {
    if (
      !allowedKeys.includes(key) ||
      params.getAll(key).length !== 1
    ) {
      throw validationError("Invalid query parameters");
    }
  }

  for (const [key, value] of Object.entries(
    req.query ?? {}
  )) {
    if (
      !allowedKeys.includes(key) ||
      typeof value !== "string"
    ) {
      throw validationError("Invalid query parameters");
    }
  }
};

const handleError = (res, error, message) => {
  if (error.statusCode === 400) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(message, error);

  return res.status(500).json({
    success: false,
    message,
  });
};

// Read recorded financial transactions only.
const scanTransactions = async ({
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

// Active loan classification and principal balances.
const getActiveLoanSummary = async ({
  session,
  calculationDate,
}) => {
  const counts = {
    activeLoans: 0,
    currentLoans: 0,
    dueToday: 0,
    upcomingDue: 0,
    gracePeriod: 0,
    overdueLoans: 0,
    unclassifiedLoans: 0,
    invalidBalanceCount: 0,
  };

  let outstandingPrincipal = 0n;
  let overduePrincipal = 0n;
  let invalidOverdueBalanceCount = 0;

  const classificationFields = {
    current: "currentLoans",
    due_today: "dueToday",
    upcoming_due: "upcomingDue",
    grace_period: "gracePeriod",
    overdue: "overdueLoans",
  };

  const cursor = PawnLoan.find({
    status: "active",
  })
    .select(
      "_id principalAmount maturityDate status " +
      "settingsSnapshot.overdue"
    )
    .session(session)
    .lean()
    .cursor({ batchSize: 200 });

  try {
    for await (const loan of cursor) {
      counts.activeLoans += 1;

      let classification = "unclassified";

      try {
        const result = calculateOverdueStatus({
          loan,
          calculationDate,
          upcomingDays: UPCOMING_DAYS,
        });

        classification = result.classification;
      } catch {
        classification = "unclassified";
      }

      const countField =
        classificationFields[classification];

      if (countField) {
        counts[countField] += 1;
      } else {
        counts.unclassifiedLoans += 1;
      }

      const payments = await PawnPayment.find({
        pawnLoan: loan._id,
      })
        .select("principalPaid")
        .session(session)
        .lean();

      // An active loan should not have a completed
      // redemption record.
      const redemptionExists =
        await PawnLoanRedemption.exists({
          pawnLoan: loan._id,
        }).session(session);

      try {
        if (redemptionExists) {
          throw new Error(
            "Active loan has a redemption record"
          );
        }

        const balance =
          calculateOutstandingPrincipal({
            originalPrincipal: loan.principalAmount,
            payments,
          });

        const principal = toCents(
          balance.outstandingPrincipal
        );

        outstandingPrincipal += principal;

        if (classification === "overdue") {
          overduePrincipal += principal;
        }
      } catch {
        counts.invalidBalanceCount += 1;

        if (classification === "overdue") {
          invalidOverdueBalanceCount += 1;
        }
      }
    }
  } finally {
    await cursor.close();
  }

  const isPrincipalTotalComplete =
    counts.invalidBalanceCount === 0;

  const isOverduePrincipalComplete =
    counts.unclassifiedLoans === 0 &&
    invalidOverdueBalanceCount === 0;

  return {
    ...counts,

    outstandingPrincipal:
      isPrincipalTotalComplete
        ? formatMoney(outstandingPrincipal)
        : null,

    knownOutstandingPrincipal:
      formatMoney(outstandingPrincipal),

    overduePrincipal:
      isOverduePrincipalComplete
        ? formatMoney(overduePrincipal)
        : null,

    knownOverduePrincipal:
      formatMoney(overduePrincipal),

    isPrincipalTotalComplete,
    isOverduePrincipalComplete,
  };
};

// GET /api/dashboard/summary
export const getDashboardSummary = async (
  req,
  res
) => {
  try {
    validateQuery(req);

    const calculationDate = new Date();

    const periods =
      getDashboardPeriods(calculationDate);

    const summary = await withReadSnapshot(
      async (session) => {
        const totalCustomers =
          await Customer.countDocuments({})
            .session(session);

        const activeCustomers =
          await Customer.countDocuments({
            status: "active",
          }).session(session);

        const inactiveCustomers =
          await Customer.countDocuments({
            status: "inactive",
          }).session(session);

        const pledgedGoldItems =
          await GoldItem.countDocuments({
            status: "pledged",
          }).session(session);

        const loans = await getActiveLoanSummary({
          session,
          calculationDate,
        });

        const today = createFinancialTotals();
        const month = createFinancialTotals();

        await scanTransactions({
          session,
          startDate: periods.monthStart,
          endDate: calculationDate,

          onTransaction: (transaction) => {
            addTransaction(month, transaction);

            if (
              transaction.transactionDate >=
              periods.todayStart
            ) {
              addTransaction(today, transaction);
            }
          },
        });

        let todayNewLoans = 0;
        let todayIssuedPrincipal = 0n;

        const cursor = PawnLoan.find({
          activatedAt: {
            $gte: periods.todayStart,
            $lte: calculationDate,
          },

          status: {
            $in: ["active", "redeemed", "closed"],
          },
        })
          .select("principalAmount")
          .session(session)
          .lean()
          .cursor({ batchSize: 200 });

        try {
          for await (const loan of cursor) {
            todayNewLoans += 1;

            todayIssuedPrincipal += toCents(
              loan.principalAmount
            );
          }
        } finally {
          await cursor.close();
        }

        return {
          totalCustomers,
          activeCustomers,
          inactiveCustomers,
          pledgedGoldItems,

          ...loans,

          todayNewLoans,

          todayIssuedPrincipal:
            formatMoney(todayIssuedPrincipal),

          today: serializeFinancialTotals(today),

          month: serializeFinancialTotals(month),
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      currency: "LKR",
      calculationDate,
      timeZone: "Asia/Colombo",
      upcomingDays: UPCOMING_DAYS,
      summary,
      includesAccruedInterest: false,
      isReadOnly: true,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load dashboard summary"
    );
  }
};

// GET /api/dashboard/financial-overview?year=2026
export const getDashboardFinancialOverview = async (
  req,
  res
) => {
  try {
    validateQuery(req, ["year"]);

    const calculationDate = new Date();

    const currentYear =
      getSriLankaDateParts(calculationDate).year;

    const yearText =
      req.query.year ?? String(currentYear);

    if (!/^\d{4}$/.test(yearText)) {
      throw validationError("Invalid year");
    }

    const year = Number(yearText);

    if (year < 2000 || year > currentYear) {
      throw validationError("Invalid year");
    }

    const startDate = new Date(
      `${year}-01-01T00:00:00+05:30`
    );

    const nextYearStart = new Date(
      `${year + 1}-01-01T00:00:00+05:30`
    );

    const endDate = new Date(
      Math.min(
        calculationDate.getTime(),
        nextYearStart.getTime() - 1
      )
    );

    const monthlyData = await withReadSnapshot(
      async (session) => {
        const months = Array.from(
          { length: 12 },
          (_, index) => ({
            month: index + 1,
            issuedLoanCount: 0,
            issuedPrincipal: 0n,
            ...createFinancialTotals(),
          })
        );

        await scanTransactions({
          session,
          startDate,
          endDate,

          onTransaction: (transaction) => {
            const { month } =
              getSriLankaDateParts(
                transaction.transactionDate
              );

            addTransaction(
              months[month - 1],
              transaction
            );
          },
        });

        const cursor = PawnLoan.find({
          activatedAt: {
            $gte: startDate,
            $lte: endDate,
          },

          status: {
            $in: ["active", "redeemed", "closed"],
          },
        })
          .select("activatedAt principalAmount")
          .session(session)
          .lean()
          .cursor({ batchSize: 200 });

        try {
          for await (const loan of cursor) {
            const { month } =
              getSriLankaDateParts(loan.activatedAt);

            const target = months[month - 1];

            target.issuedLoanCount += 1;

            target.issuedPrincipal += toCents(
              loan.principalAmount
            );
          }
        } finally {
          await cursor.close();
        }

        return months.map((month) => ({
          month: month.month,

          issuedLoanCount: month.issuedLoanCount,

          issuedPrincipal: formatMoney(
            month.issuedPrincipal
          ),

          ...serializeFinancialTotals(month),
        }));
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      currency: "LKR",
      year,
      calculationDate,
      monthlyData,
      isProfitReport: false,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load financial overview"
    );
  }
};

// GET /api/dashboard/loan-status
export const getDashboardLoanStatus = async (
  req,
  res
) => {
  try {
    validateQuery(req);

    const calculationDate = new Date();

    const result = await withReadSnapshot(
      async (session) => {
        const statusCounts = {
          draft: 0,
          active: 0,
          redeemed: 0,
          closed: 0,
          cancelled: 0,
          unknown: 0,
        };

        const grouped = await PawnLoan.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]).session(session);

        for (const group of grouped) {
          if (
            Object.hasOwn(statusCounts, group._id)
          ) {
            statusCounts[group._id] += group.count;
          } else {
            statusCounts.unknown += group.count;
          }
        }

        const activeLoanSummary =
          await getActiveLoanSummary({
            session,
            calculationDate,
          });

        return {
          totalLoans: Object.values(statusCounts)
            .reduce((sum, count) => sum + count, 0),

          statusCounts,

          activeLoanSummary,
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      calculationDate,
      currency: "LKR",
      ...result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load loan status analytics"
    );
  }
};

// GET /api/dashboard/recent-activity
export const getDashboardRecentActivity = async (
  req,
  res
) => {
  try {
    validateQuery(req);

    const calculationDate = new Date();

    const result = await withReadSnapshot(
      async (session) => {
        const recentCustomers = await Customer.find({
          createdAt: { $lte: calculationDate },
        })
          .select(
            "_id customerCode fullName status createdAt"
          )
          .sort({ createdAt: -1, _id: -1 })
          .limit(5)
          .session(session)
          .lean();

        const recentLoans = await PawnLoan.find({
          activatedAt: { $lte: calculationDate },

          status: {
            $in: ["active", "redeemed", "closed"],
          },
        })
          .select(
            "_id loanNumber customer principalAmount " +
            "status activatedAt"
          )
          .populate(
            "customer",
            "customerCode fullName"
          )
          .sort({ activatedAt: -1, _id: -1 })
          .limit(5)
          .session(session)
          .lean();

        const transactions = [];

        for (const source of TRANSACTION_SOURCES) {
          const records = await source.model.find({
            [source.dateField]: {
              $lte: calculationDate,
            },
          })
            .select(source.fields)
            .populate({
              path: "pawnLoan",
              select: "loanNumber customer",
              populate: {
                path: "customer",
                select: "customerCode fullName",
              },
            })
            .sort({
              [source.dateField]: -1,
              _id: -1,
            })
            .limit(10)
            .session(session)
            .lean();

          for (const record of records) {
            const transaction = normalizeTransaction(
              record,
              source.type
            );

            transactions.push({
              id: transaction.id,
              type: transaction.type,

              transactionDate:
                transaction.transactionDate,

              loanNumber:
                record.pawnLoan?.loanNumber ?? null,

              customer:
                record.pawnLoan?.customer ?? null,

              principal: formatMoney(
                transaction.principal
              ),

              interest: formatMoney(
                transaction.interest
              ),

              fee: formatMoney(transaction.fee),

              penalty: formatMoney(
                transaction.penalty
              ),

              amount: formatMoney(transaction.total),
            });
          }
        }

        transactions.sort((a, b) => {
          const dateDifference =
            b.transactionDate.getTime() -
            a.transactionDate.getTime();

          if (dateDifference !== 0) {
            return dateDifference;
          }

          const typeDifference =
            a.type.localeCompare(b.type);

          if (typeDifference !== 0) {
            return typeDifference;
          }

          return String(b.id).localeCompare(
            String(a.id)
          );
        });

        return {
          recentCustomers,

          recentLoans: recentLoans.map((loan) => ({
            ...loan,
            principalAmount: formatMoney(
              toCents(loan.principalAmount)
            ),
          })),

          recentTransactions:
            transactions.slice(0, 10),
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      calculationDate,
      currency: "LKR",
      ...result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load recent dashboard activity"
    );
  }
};