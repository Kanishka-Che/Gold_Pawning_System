import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  calculateOutstandingPrincipal,
} from "./outstandingBalance.js";

import {
  calculateOverdueStatus,
} from "./overdueCalculator.js";

import {
  toCents,
  formatMoney,
} from "./dashboardCalculator.js";

const UPCOMING_DAYS = 7;

const LOAN_FIELDS =
  "_id loanNumber customer principalAmount " +
  "issueDate maturityDate activatedAt status " +
  "settingsVersion settingsSnapshot.overdue";

const classifyLoan = (
  loan,
  calculationDate
) => {
  try {
    return {
      ...calculateOverdueStatus({
        loan,
        calculationDate,
        upcomingDays: UPCOMING_DAYS,
      }),

      classificationError: null,
    };
  } catch (error) {
    return {
      classification: "unclassified",

      daysOverdue: null,
      daysUntilMaturity: null,
      gracePeriodDays: null,
      daysAfterGrace: null,
      remainingGraceDays: null,

      isOverdue: false,

      classificationError: error.message,
    };
  }
};

export const getLoanBalance = async ({
  loan,
  session,
}) => {
  const payments = await PawnPayment.find({
    pawnLoan: loan._id,
  })
    .select("principalPaid")
    .session(session)
    .lean();

  const redemptionExists =
    await PawnLoanRedemption.exists({
      pawnLoan: loan._id,
    }).session(session);

  try {
    if (redemptionExists) {
      throw new Error(
        "Active loan has a completed redemption record"
      );
    }

    if (toCents(loan.principalAmount) <= 0n) {
      throw new Error(
        "Invalid original principal"
      );
    }

    const balance =
      calculateOutstandingPrincipal({
        originalPrincipal: loan.principalAmount,
        payments,
      });

    return {
      balance,
      balanceError: null,
    };
  } catch (error) {
    return {
      balance: null,
      balanceError: error.message,
    };
  }
};

export const buildActiveLoanReport = async ({
  session,
  calculationDate,
  page,
  limit,
  overdueOnly = false,
  search = "",
}) => {
  const records = [];

  const normalizedSearch =
    search.trim().toLowerCase();

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  let total = 0;

  let activeLoans = 0;
  let currentLoans = 0;
  let dueToday = 0;
  let upcomingDue = 0;
  let gracePeriod = 0;
  let overdueLoans = 0;
  let unclassifiedLoans = 0;

  let invalidBalanceCount = 0;
  let validBalanceCount = 0;

  let originalPrincipal = 0n;
  let principalPaid = 0n;
  let outstandingPrincipal = 0n;

  const cursor = PawnLoan.find({
    status: "active",
  })
    .select(LOAN_FIELDS)
    .populate(
      "customer",
      "customerCode fullName"
    )
    .sort({
      maturityDate: 1,
      _id: 1,
    })
    .session(session)
    .lean()
    .cursor({ batchSize: 200 });

  try {
    for await (const loan of cursor) {
      // Optional customer / loan search.
      if (normalizedSearch) {
        const searchableValues = [
          loan.loanNumber,
          loan.customer?.customerCode,
          loan.customer?.fullName,
        ];

        const matches = searchableValues.some(
          (value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(normalizedSearch)
        );

        if (!matches) continue;
      }

      activeLoans += 1;

      const classification = classifyLoan(
        loan,
        calculationDate
      );

      switch (classification.classification) {
        case "current":
          currentLoans += 1;
          break;

        case "due_today":
          dueToday += 1;
          break;

        case "upcoming_due":
          upcomingDue += 1;
          break;

        case "grace_period":
          gracePeriod += 1;
          break;

        case "overdue":
          overdueLoans += 1;
          break;

        case "unclassified":
          unclassifiedLoans += 1;
          break;

        default:
          throw new Error(
            "Unexpected loan classification"
          );
      }

      // Overdue report includes only confirmed
      // overdue loans.
      if (
        overdueOnly &&
        classification.classification !== "overdue"
      ) {
        continue;
      }

      const {
        balance,
        balanceError,
      } = await getLoanBalance({
        loan,
        session,
      });

      if (balance) {
        validBalanceCount += 1;

        originalPrincipal += toCents(
          balance.originalPrincipal
        );

        principalPaid += toCents(
          balance.totalPrincipalPaid
        );

        outstandingPrincipal += toCents(
          balance.outstandingPrincipal
        );
      } else {
        invalidBalanceCount += 1;
      }

      // Only return records for the requested page.
      if (
        total >= startIndex &&
        total < endIndex
      ) {
        records.push({
          id: loan._id,

          loanNumber: loan.loanNumber,

          customer: loan.customer ?? null,

          issueDate: loan.issueDate,
          maturityDate: loan.maturityDate,
          activatedAt: loan.activatedAt,

          status: loan.status,

          settingsVersion:
            loan.settingsVersion,

          classification:
            classification.classification,

          daysOverdue:
            classification.daysOverdue,

          daysUntilMaturity:
            classification.daysUntilMaturity,

          gracePeriodDays:
            classification.gracePeriodDays,

          daysAfterGrace:
            classification.daysAfterGrace,

          remainingGraceDays:
            classification.remainingGraceDays,

          classificationError:
            classification.classificationError,

          originalPrincipal:
            balance?.originalPrincipal ?? null,

          totalPrincipalPaid:
            balance?.totalPrincipalPaid ?? null,

          outstandingPrincipal:
            balance?.outstandingPrincipal ?? null,

          balanceError,
        });
      }

      total += 1;
    }
  } finally {
    await cursor.close();
  }

  const isClassificationComplete =
    unclassifiedLoans === 0;

  const isPrincipalTotalComplete =
    invalidBalanceCount === 0 &&
    (
      !overdueOnly ||
      isClassificationComplete
    );

  return {
    summary: {
      activeLoans,
      currentLoans,
      dueToday,
      upcomingDue,
      gracePeriod,
      overdueLoans,
      unclassifiedLoans,

      reportLoanCount: total,

      validBalanceCount,
      invalidBalanceCount,

      totalOriginalPrincipal:
        isPrincipalTotalComplete
          ? formatMoney(originalPrincipal)
          : null,

      totalPrincipalPaid:
        isPrincipalTotalComplete
          ? formatMoney(principalPaid)
          : null,

      totalOutstandingPrincipal:
        isPrincipalTotalComplete
          ? formatMoney(outstandingPrincipal)
          : null,

      knownOriginalPrincipal:
        formatMoney(originalPrincipal),

      knownPrincipalPaid:
        formatMoney(principalPaid),

      knownOutstandingPrincipal:
        formatMoney(outstandingPrincipal),

      isClassificationComplete,
      isPrincipalTotalComplete,
    },

    records,

    pagination: {
      page,
      limit,
      total,

      totalPages: Math.ceil(
        total / limit
      ),
    },
  };
};