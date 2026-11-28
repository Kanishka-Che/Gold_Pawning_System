
import {
  calculatePawnInterest,
} from "./interestCalculator.js";

import {
  calculateLoanBalanceSummary,
} from "../utils/loanBalanceSummary.js";

import {
  validateLegacyHistory,
  toMoneyCents,
} from "../utils/legacyTransactionValidator.js";

import {
  LegacyInterestError,
  validateLegacyInterestLoan,
  validateLegacyOpeningBalance,
} from "../utils/legacyInterestValidator.js";

import {
  toSriLankaCalendarDay,
} from "../utils/renewalDateCalculator.js";


// Format monetary amounts without floating-point addition
const formatCents = (cents) => {
  if (
    cents < 0n ||
    cents > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new LegacyInterestError(
      "Calculated amount exceeds supported range"
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


const calculatedMoneyToCents = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d+\.\d{2}$/.test(value)
  ) {
    throw new LegacyInterestError(
      "Invalid calculated monetary amount"
    );
  }

  const [whole, fraction] = value.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction);

  if (
    cents > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new LegacyInterestError(
      "Calculated amount exceeds supported range"
    );
  }

  return cents;
};


// Calculate from verified opening balance
const calculateFromOpeningBalance = ({
  loan,
  calculationDate,
  interestSettings,
}) => {
  const balance =
    validateLegacyOpeningBalance(loan);

  const originalPrincipal =
    toMoneyCents(loan.principalAmount);

  const principalPaid =
    toMoneyCents(balance.principalPaid);

  const outstandingPrincipal =
    toMoneyCents(
      balance.outstandingPrincipal
    );

  const previousInterest =
    toMoneyCents(
      balance.outstandingInterest
    );

  if (
    principalPaid + outstandingPrincipal !==
    originalPrincipal
  ) {
    throw new LegacyInterestError(
      "Opening balance principal is inconsistent"
    );
  }

  if (outstandingPrincipal === 0n) {
    throw new LegacyInterestError(
      "Fully settled historical loans are not supported"
    );
  }

  // Select the correct principal calculation base
  const calculationPrincipal =
    interestSettings.principalCalculationMethod ===
    "original_principal"
      ? loan.principalAmount
      : balance.outstandingPrincipal;

  const result = calculatePawnInterest({
    principalAmount: calculationPrincipal,

    issueDate: balance.asOfDate,

    calculationDate,

    interestSettings,

    payments: [],
  });

  const additionalInterest =
    calculatedMoneyToCents(
      result.accruedInterest
    );

  const outstandingInterest =
    previousInterest + additionalInterest;

  const combinedBalance =
    outstandingPrincipal +
    outstandingInterest;

  return {
    historyMode: "opening_balance",

    originalPrincipal:
      formatCents(originalPrincipal),

    totalPrincipalPaid:
      formatCents(principalPaid),

    outstandingPrincipal:
      formatCents(outstandingPrincipal),

    openingBalanceDate:
      balance.asOfDate,

    openingOutstandingInterest:
      formatCents(previousInterest),

    additionalAccruedInterest:
      formatCents(additionalInterest),

    outstandingInterest:
      formatCents(outstandingInterest),

    combinedBalance:
      formatCents(combinedBalance),

    elapsedDays: result.elapsedDays,

    chargedMonths: result.chargedMonths,

    calculationMethod:
      result.calculationMethod,

    principalCalculationMethod:
      result.principalCalculationMethod,

    effectiveMaturityDate:
      loan.maturityDate,

    // Opening balance preview assumes
    // a new accrual period from balance date.
    calculationAssumption:
      "opening_balance_period_restart",

    requiresInterestReconciliation: true,
  };
};


// Calculate from verified historical transactions
const calculateFromFullHistory = ({
  loan,
  transactions,
  calculationDate,
  interestSettings,
}) => {
  if (!Array.isArray(transactions)) {
    throw new LegacyInterestError(
      "Historical transactions are required"
    );
  }

  const historicalRecords = transactions
    .filter(
      (item) => item.status !== "voided"
    )
    .sort(
      (a, b) =>
        a.sequenceNumber - b.sequenceNumber
    );

  if (
    !loan.legacyHistoryVerifiedAt ||
    !loan.legacyHistoryVerifiedBy ||
    !Number.isSafeInteger(
      loan.legacyHistoryVersion
    ) ||
    loan.legacyHistoryVersion < 1
  ) {
    throw new LegacyInterestError(
      "Historical verification information is missing"
    );
  }

  const calculationDay =
    toSriLankaCalendarDay(calculationDate);

  for (const item of historicalRecords) {
    if (
      String(item.pawnLoan) !==
      String(loan._id)
    ) {
      throw new LegacyInterestError(
        "Historical transaction belongs to another loan"
      );
    }

    if (
      item.status !== "verified" ||
      !item.verifiedAt ||
      !item.verifiedBy
    ) {
      throw new LegacyInterestError(
        "Unverified historical transaction found"
      );
    }

    if (
      !["payment", "renewal"].includes(
        item.transactionType
      )
    ) {
      throw new LegacyInterestError(
        "Invalid historical transaction type"
      );
    }

    if (
      toSriLankaCalendarDay(
        item.transactionDate
      ) > calculationDay
    ) {
      throw new LegacyInterestError(
        "Historical transaction is after calculation date"
      );
    }
  }

  const history = validateLegacyHistory({
    loan,
    transactions: historicalRecords,
  });

  if (history.outstandingPrincipal === 0) {
    throw new LegacyInterestError(
      "Fully settled historical loans are not supported"
    );
  }

  // Convert verified historical records into
  // the existing interest calculator format.
  const payments = historicalRecords.map(
    (item) => ({
      paidAt: new Date(
        item.transactionDate
      ).toISOString(),

      principalPaid:
        item.transactionType === "payment"
          ? item.principalPaid
          : 0,

      interestPaid: item.interestPaid,
    })
  );

  // Renewal fees are intentionally excluded
  // from interest payment deductions.

  const result = calculatePawnInterest({
    principalAmount: loan.principalAmount,

    issueDate: loan.issueDate,

    calculationDate,

    interestSettings,

    payments,
  });

  const balances = calculateLoanBalanceSummary({
    originalPrincipal: loan.principalAmount,

    accruedInterest: result.accruedInterest,

    payments,
  });

  return {
    historyMode: "full_history",

    ...balances,

    elapsedDays: result.elapsedDays,

    chargedMonths: result.chargedMonths,

    calculationMethod:
      result.calculationMethod,

    principalCalculationMethod:
      result.principalCalculationMethod,

    transactionCount:
      history.transactionCount,

    paymentCount: history.paymentCount,

    renewalCount: history.renewalCount,

    paymentInterestPaid:
      formatCents(
        toMoneyCents(
          history.paymentInterestPaid
        )
      ),

    renewalInterestPaid:
      formatCents(
        toMoneyCents(
          history.renewalInterestPaid
        )
      ),

    totalRenewalFees:
      formatCents(
        toMoneyCents(
          history.totalRenewalFees
        )
      ),

    originalMaturityDate:
      history.originalMaturityDate,

    effectiveMaturityDate:
      history.effectiveMaturityDate,

    // Historical renewals extend maturity,
    // but do not reset interest accrual
    // in this provisional calculation.
    calculationAssumption:
      "continuous_interest_from_original_issue",

    requiresInterestReconciliation: true,
  };
};


// Main legacy interest calculation function
export const calculateLegacyPawnInterest = ({
  loan,
  transactions = [],
  calculationDate = new Date(),
}) => {
  const interestSettings =
    validateLegacyInterestLoan({
      loan,
      calculationDate,
    });

  // This service currently calculates historical
  // migration previews only.
  // Active loan integration will be added later.
  if (loan.status !== "draft") {
    throw new LegacyInterestError(
      "Only legacy migration previews are currently supported"
    );
  }

  if (
    loan.legacyMigrationStatus !== "verified"
  ) {
    throw new LegacyInterestError(
      "Verified migration data is required"
    );
  }

  let result;

  try {
    if (
      loan.legacyHistoryMode ===
      "opening_balance"
    ) {
      if (
        !Array.isArray(transactions) ||
        transactions.length > 0
      ) {
        throw new LegacyInterestError(
          "Opening balance loans cannot contain historical transactions"
        );
      }

      result = calculateFromOpeningBalance({
        loan,
        calculationDate,
        interestSettings,
      });
    } else {
      if (loan.openingBalance != null) {
        throw new LegacyInterestError(
          "Full history loans cannot contain opening balances"
        );
      }

      result = calculateFromFullHistory({
        loan,
        transactions,
        calculationDate,
        interestSettings,
      });
    }
  } catch (error) {
    if (error instanceof LegacyInterestError) {
      throw error;
    }

    throw new LegacyInterestError(
      error.message
    );
  }

  return {
    ...result,

    pawnLoanId: String(loan._id),

    loanNumber: loan.loanNumber,

    legacyTicketNumber:
      loan.legacyTicketNumber,

    recordSource: "legacy",

    loanStatus: loan.status,

    issueDate: loan.issueDate,

    calculationDate,

    monthlyRate: interestSettings.rate,

    currency: "LKR",

    settingsVersion: loan.settingsVersion,

    legacyRulesStatus:
      loan.legacyRulesStatus,

    legacyMigrationStatus:
      loan.legacyMigrationStatus,

    isProvisional: true,

    isFinalSettlementAmount: false,

    canActivate: false,

    canRecordPayment: false,

    canRenew: false,

    canRedeem: false,
  };
};
