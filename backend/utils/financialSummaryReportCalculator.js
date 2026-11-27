import PawnLoan from "../models/PawnLoan.js";

import {
  toCents,
  formatMoney,
  createFinancialTotals,
  addTransaction,
  serializeFinancialTotals,
} from "./dashboardCalculator.js";

import {
  scanReportTransactions,
  createTransactionCounts,
  addTransactionCount,
} from "./reportCalculator.js";

import {
  buildActiveLoanReport,
} from "./activeLoanReportCalculator.js";

const formatSignedMoney = (cents) => {
  if (cents < 0n) {
    return "-" + formatMoney(-cents);
  }

  return formatMoney(cents);
};

export const buildFinancialSummaryReport =
  async ({
    session,
    startDate,
    endDate,
    calculationDate,
  }) => {
    const totals = createFinancialTotals();

    const transactionCounts =
      createTransactionCounts();

    let totalIssuedLoans = 0;
    let totalIssuedPrincipal = 0n;

    // Loans issued within the selected period.
    const issuedLoanCursor = PawnLoan.find({
      activatedAt: {
        $gte: startDate,
        $lte: endDate,
      },

      status: {
        $in: [
          "active",
          "redeemed",
          "closed",
        ],
      },
    })
      .select("_id principalAmount")
      .session(session)
      .lean()
      .cursor({ batchSize: 200 });

    try {
      for await (const loan of issuedLoanCursor) {
        const principal = toCents(
          loan.principalAmount
        );

        if (principal <= 0n) {
          throw new Error(
            "Invalid issued principal"
          );
        }

        totalIssuedLoans += 1;
        totalIssuedPrincipal += principal;
      }
    } finally {
      await issuedLoanCursor.close();
    }

    // Recorded financial collections
    // within the selected period.
    await scanReportTransactions({
      session,
      startDate,
      endDate,

      onTransaction: (transaction) => {
        addTransaction(
          totals,
          transaction
        );

        addTransactionCount(
          transactionCounts,
          transaction.type
        );
      },
    });

    const nonPrincipalCollections =
      totals.interestReceived +
      totals.renewalFees +
      totals.penaltiesReceived;

    const netLoanCashMovement =
      totals.totalCollections -
      totalIssuedPrincipal;

    // Current outstanding principal.
    // This is NOT a historical balance.
    const activeLoanReport =
      await buildActiveLoanReport({
        session,
        calculationDate,
        page: 1,
        limit: 1,
        overdueOnly: false,
        search: "",
      });

    const currentSummary =
      activeLoanReport.summary;

    const periodSummary = {
      totalIssuedLoans,

      totalIssuedPrincipal:
        formatMoney(totalIssuedPrincipal),

      ...serializeFinancialTotals(totals),

      ...transactionCounts,

      nonPrincipalCollections:
        formatMoney(
          nonPrincipalCollections
        ),

      netLoanCashMovement:
        formatSignedMoney(
          netLoanCashMovement
        ),
    };

    const currentPosition = {
      activeLoans:
        currentSummary.activeLoans,

      currentLoans:
        currentSummary.currentLoans,

      dueToday:
        currentSummary.dueToday,

      upcomingDue:
        currentSummary.upcomingDue,

      gracePeriod:
        currentSummary.gracePeriod,

      overdueLoans:
        currentSummary.overdueLoans,

      unclassifiedLoans:
        currentSummary.unclassifiedLoans,

      totalOutstandingPrincipal:
        currentSummary
          .totalOutstandingPrincipal,

      knownOutstandingPrincipal:
        currentSummary
          .knownOutstandingPrincipal,

      invalidBalanceCount:
        currentSummary.invalidBalanceCount,

      isPrincipalTotalComplete:
        currentSummary
          .isPrincipalTotalComplete,

      isClassificationComplete:
        currentSummary
          .isClassificationComplete,
    };

    return {
      summary: periodSummary,

      currentPosition,

      records: [
        {
          key: "issued_principal",
          label: "Issued Principal",
          category: "cash_outflow",
          amount:
            periodSummary.totalIssuedPrincipal,
        },
        {
          key: "principal_received",
          label: "Principal Received",
          category: "cash_inflow",
          amount:
            periodSummary.principalReceived,
        },
        {
          key: "interest_received",
          label: "Interest Received",
          category: "cash_inflow",
          amount:
            periodSummary.interestReceived,
        },
        {
          key: "renewal_fees",
          label: "Renewal Fees",
          category: "cash_inflow",
          amount:
            periodSummary.renewalFees,
        },
        {
          key: "penalties_received",
          label: "Penalties Received",
          category: "cash_inflow",
          amount:
            periodSummary.penaltiesReceived,
        },
        {
          key: "total_collections",
          label: "Total Collections",
          category: "subtotal",
          amount:
            periodSummary.totalCollections,
        },
        {
          key: "non_principal_collections",
          label: "Non-Principal Collections",
          category: "subtotal",
          amount:
            periodSummary
              .nonPrincipalCollections,
        },
        {
          key: "net_loan_cash_movement",
          label: "Net Loan Cash Movement",
          category: "net_movement",
          amount:
            periodSummary.netLoanCashMovement,
        },
      ],
    };
  };