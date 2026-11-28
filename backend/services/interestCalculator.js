import {
  calculateLoanInterest,
  calculateInterestPeriod,
} from "../utils/interestCalculator.js";

import {
  calculateRemainingPrincipalDailyInterest,
} from "../utils/remainingPrincipalInterest.js";

import {
  calculateOutstandingInterest,
} from "../utils/outstandingInterest.js";

import {
  validateSupportedInterestSettings,
} from "../utils/interestSettingsValidator.js";

export function calculatePawnInterest({
  principalAmount,
  issueDate,
  calculationDate = new Date(),
  interestSettings,
  payments = [],
}) {
  // 1. Validate supported interest settings
  try {
    validateSupportedInterestSettings(
      interestSettings
    );
  } catch (validationError) {
    const error = new Error(
      validationError.message
    );

    error.statusCode = 409;
    throw error;
  }

  // 2. Validate payment history
  if (!Array.isArray(payments)) {
    throw new Error("Payments must be an array");
  }

  // 3. Calculate interest period
  const period = calculateInterestPeriod({
    issueDate,
    calculationDate,
  });

  const {
    calculationMethod,
    principalCalculationMethod,
    rate,
  } = interestSettings;

  let result;

  // 4. Original principal calculation
  if (
    principalCalculationMethod ===
    "original_principal"
  ) {
    const originalResult = calculateLoanInterest({
      principalAmount,
      interestSettings,
      months: period.months,
      days: period.days,
    });

    const balances = calculateOutstandingInterest({
      accruedInterest: originalResult.interestAmount,
      payments,
    });

    result = {
      ...originalResult,
      ...balances,
    };
  }

  // 5. Remaining principal calculation
  else if (
    principalCalculationMethod ===
      "remaining_principal" &&
    calculationMethod === "daily"
  ) {
    const remainingResult =
      calculateRemainingPrincipalDailyInterest({
        originalPrincipal: principalAmount,
        issueDate: new Date(issueDate).toISOString(),
        calculationDate: new Date(
          calculationDate
        ).toISOString(),
        payments,
        monthlyRate: rate,
      });

    const balances = calculateOutstandingInterest({
      accruedInterest:
        remainingResult.accruedInterest,
      payments,
    });

    result = {
      ...remainingResult,
      ...balances,
    };
  } else {
    const error = new Error(
      "Unsupported interest calculation method"
    );

    error.statusCode = 409;
    throw error;
  }

  // 6. Return common calculation result
  return {
    elapsedDays: period.days,

    chargedMonths:
      calculationMethod === "monthly"
        ? period.months
        : null,

    currency: "LKR",

    ...result,

    calculationMethod,
    principalCalculationMethod,

    isFinalSettlementAmount: false,
  };
}