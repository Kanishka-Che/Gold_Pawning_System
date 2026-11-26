
import { buildPrincipalHistory } from "./principalHistory.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SL_OFFSET_MS = 330 * 60 * 1000;
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function sriLankaDay(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid calculation date");
  }

  return Math.floor(
    (date.getTime() + SL_OFFSET_MS) / DAY_MS
  );
}

function toCents(value) {
  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Invalid principal amount");
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > MAX_CENTS) {
    throw new Error("Principal exceeds supported range");
  }

  return cents;
}

function formatCents(cents) {
  return (
    (cents / 100n).toString() +
    "." +
    (cents % 100n).toString().padStart(2, "0")
  );
}

export function calculateRemainingPrincipalDailyInterest({
  originalPrincipal,
  issueDate,
  calculationDate,
  payments,
  monthlyRate,
}) {
  
  if (
    typeof monthlyRate !== "number" ||
    !Number.isFinite(monthlyRate) ||
    monthlyRate < 0 ||
    monthlyRate > 100
  ) {
    throw new Error(
      "Invalid monthly rate (0–100%)"
    );
  }

  const scaledRate = monthlyRate * 10000;
  const roundedRate = Math.round(scaledRate);

  if (
    Math.abs(scaledRate - roundedRate) > 1e-8
  ) {
    throw new Error(
      "Monthly rate supports maximum 4 decimal places"
    );
  }

  const rateUnits = BigInt(roundedRate);


  const history = buildPrincipalHistory({
    originalPrincipal,
    issueDate,
    calculationDate,
    payments,
  });

  const denominator = 100n * 30n * 10000n;

  let interestNumerator = 0n;
  let totalDays = 0;

  const periods = history.periods.map((period) => {
    const days =
      sriLankaDay(period.to) -
      sriLankaDay(period.from);

    if (days < 0) {
      throw new Error("Invalid interest period");
    }

    const principalCents = toCents(period.principal);

    interestNumerator +=
      principalCents * rateUnits * BigInt(days);

    totalDays += days;

    return {
      ...period,
      days,
    };
  });

  // Round once after summing all period interest.
  const interestCents =
    (interestNumerator + denominator / 2n) /
    denominator;

  if (interestCents > MAX_CENTS) {
    throw new Error("Interest exceeds supported range");
  }

  return {
    calculationMethod: "daily",
    principalCalculationMethod: "remaining_principal",
    monthlyRate,
    totalDays,
    originalPrincipal: history.originalPrincipal,
    outstandingPrincipal: history.outstandingPrincipal,
    accruedInterest: formatCents(interestCents),
    periods,
  };
}
