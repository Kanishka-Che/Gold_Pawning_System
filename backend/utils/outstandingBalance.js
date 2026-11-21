
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function toCents(value, fieldName) {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new Error(`${fieldName} must be a valid amount`);
  }

  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`${fieldName} must have at most 2 decimal places`);
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > MAX_CENTS) {
    throw new Error(`${fieldName} exceeds supported range`);
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

export function calculateOutstandingPrincipal({
  originalPrincipal,
  payments,
}) {
  const principal = toCents(
    originalPrincipal,
    "Original principal"
  );

  if (!Array.isArray(payments)) {
    throw new Error("Payments must be an array");
  }

  let totalPrincipalPaid = 0n;

  for (const payment of payments) {
    if (
      !payment ||
      typeof payment !== "object" ||
      Array.isArray(payment)
    ) {
      throw new Error("Invalid payment record");
    }

    const paid = toCents(
      payment.principalPaid,
      "Principal paid"
    );

    totalPrincipalPaid += paid;

    if (totalPrincipalPaid > principal) {
      throw new Error(
        "Total principal payments exceed original principal"
      );
    }
  }

  return {
    originalPrincipal: fromCents(principal),
    totalPrincipalPaid: fromCents(totalPrincipalPaid),
    outstandingPrincipal: fromCents(
      principal - totalPrincipalPaid
    ),
  };
}
