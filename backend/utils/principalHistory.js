
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function toCents(value, name) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error(`Invalid ${name}`);
  }

  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid ${name}`);
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > MAX_CENTS) {
    throw new Error(`${name} exceeds supported range`);
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

function validDate(value, name) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid ${name}`);
  }

  return date;
}

export function buildPrincipalHistory({
  originalPrincipal,
  issueDate,
  calculationDate,
  payments,
}) {
  const original = toCents(
    originalPrincipal,
    "original principal"
  );

  if (original <= 0n) {
    throw new Error(
      "Original principal must be greater than zero"
    );
  }

  const start = validDate(issueDate, "issue date");
  const end = validDate(
    calculationDate,
    "calculation date"
  );

  if (end < start) {
    throw new Error(
      "Calculation date cannot precede issue date"
    );
  }

  if (!Array.isArray(payments)) {
    throw new Error("Payments must be an array");
  }

  const normalizedPayments = payments.map((payment) => {
    if (
      !payment ||
      typeof payment !== "object" ||
      Array.isArray(payment)
    ) {
      throw new Error("Invalid payment record");
    }

    const paidAt = validDate(
      payment.paidAt,
      "payment date"
    );

    if (paidAt < start || paidAt > end) {
      throw new Error(
        "Payment date outside calculation period"
      );
    }

    const principalPaid = toCents(
      payment.principalPaid,
      "principal payment"
    );

    return { paidAt, principalPaid };
  });

  normalizedPayments.sort(
    (a, b) => a.paidAt - b.paidAt
  );

  let outstanding = original;
  let cursor = start;

  const periods = [];

  for (const payment of normalizedPayments) {
    if (payment.principalPaid > outstanding) {
      throw new Error(
        "Principal payments exceed outstanding principal"
      );
    }

    if (payment.paidAt > cursor) {
      periods.push({
        from: cursor.toISOString(),
        to: payment.paidAt.toISOString(),
        principal: fromCents(outstanding),
      });
    }

    outstanding -= payment.principalPaid;
    cursor = payment.paidAt;
  }

  if (end > cursor) {
    periods.push({
      from: cursor.toISOString(),
      to: end.toISOString(),
      principal: fromCents(outstanding),
    });
  }

  return {
    originalPrincipal: fromCents(original),
    outstandingPrincipal: fromCents(outstanding),
    periods,
  };
}
