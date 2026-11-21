
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

export function validatePaymentRecord({
  amount,
  principalPaid,
  interestPaid,
}) {
  const paymentCents = toCents(amount, "Payment");
  const principalCents = toCents(
    principalPaid,
    "Principal paid"
  );
  const interestCents = toCents(
    interestPaid,
    "Interest paid"
  );

  if (paymentCents <= 0n) {
    throw new Error(
      "Payment must be greater than zero"
    );
  }

  if (
    principalCents + interestCents !== paymentCents
  ) {
    throw new Error(
      "Principal paid plus interest paid must equal payment amount"
    );
  }

  return {
    amount: fromCents(paymentCents),
    principalPaid: fromCents(principalCents),
    interestPaid: fromCents(interestCents),
    valid: true,
  };
}
