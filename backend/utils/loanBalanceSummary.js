
import {
  calculateOutstandingPrincipal,
} from "./outstandingBalance.js";

import {
  calculateOutstandingInterest,
} from "./outstandingInterest.js";

const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function toCents(value) {
  if (
    typeof value !== "string" ||
    !/^\d+\.\d{2}$/.test(value)
  ) {
    throw new Error("Invalid calculated monetary amount");
  }

  const [whole, fraction] = value.split(".");

  const cents =
    BigInt(whole) * 100n + BigInt(fraction);

  if (cents > MAX_CENTS) {
    throw new Error("Combined amount exceeds safe range");
  }

  return cents;
}

function fromCents(cents) {
  return (
    (cents / 100n).toString() +
    "." +
    (cents % 100n).toString().padStart(2, "0")
  );
}

export function calculateLoanBalanceSummary({
  originalPrincipal,
  accruedInterest,
  payments,
}) {
  if (!Array.isArray(payments)) {
    throw new Error("Payments must be an array");
  }

  const principal = calculateOutstandingPrincipal({
    originalPrincipal,
    payments,
  });

  const interest = calculateOutstandingInterest({
    accruedInterest,
    payments,
  });

  const totalCents =
    toCents(principal.outstandingPrincipal) +
    toCents(interest.outstandingInterest);

  if (totalCents > MAX_CENTS) {
    throw new Error("Combined balance exceeds safe range");
  }

  return {
    originalPrincipal: principal.originalPrincipal,
    totalPrincipalPaid: principal.totalPrincipalPaid,
    outstandingPrincipal:
      principal.outstandingPrincipal,

    accruedInterest: interest.accruedInterest,
    totalInterestPaid: interest.totalInterestPaid,
    outstandingInterest:
      interest.outstandingInterest,

    combinedBalance: fromCents(totalCents),

    // This is NOT a final redemption amount.
    isFinalSettlementAmount: false,
  };
}
