
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function toCents(value, fieldName) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error(`${fieldName} must be a valid amount`);
  }

  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(
      `${fieldName} must have at most 2 decimal places`
    );
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > MAX_CENTS) {
    throw new Error(
      `${fieldName} exceeds supported range`
    );
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

export function calculateOutstandingInterest({
  accruedInterest,
  payments,
}) {
  const accrued = toCents(
    accruedInterest,
    "Accrued interest"
  );

  if (!Array.isArray(payments)) {
    throw new Error("Payments must be an array");
  }

  let totalInterestPaid = 0n;

  for (const payment of payments) {
    if (
      !payment ||
      typeof payment !== "object" ||
      Array.isArray(payment)
    ) {
      throw new Error("Invalid payment record");
    }

    totalInterestPaid += toCents(
      payment.interestPaid,
      "Interest paid"
    );

    if (totalInterestPaid > accrued) {
      throw new Error(
        "Total interest paid exceeds accrued interest"
      );
    }
  }

  return {
    accruedInterest: fromCents(accrued),
    totalInterestPaid: fromCents(totalInterestPaid),
    outstandingInterest: fromCents(
      accrued - totalInterestPaid
    ),
  };
}
