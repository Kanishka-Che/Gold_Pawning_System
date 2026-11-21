
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
    throw new Error(`${fieldName} must have at most 2 decimal places`);
  }

  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n +
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

export function allocatePawnPayment({
  paymentAmount,
  outstandingPrincipal,
  outstandingInterest,
  allocationMethod,
}) {
  const payment = toCents(paymentAmount, "Payment");
  const principal = toCents(
    outstandingPrincipal,
    "Outstanding principal"
  );
  const interest = toCents(
    outstandingInterest,
    "Outstanding interest"
  );

  if (payment <= 0n) {
    throw new Error("Payment must be greater than zero");
  }

  if (
    allocationMethod !== "interest_first" &&
    allocationMethod !== "principal_first"
  ) {
    throw new Error("Unsupported payment allocation method");
  }

  if (payment > principal + interest) {
    throw new Error("Payment exceeds outstanding balance");
  }

  let interestPaid = 0n;
  let principalPaid = 0n;

  if (allocationMethod === "interest_first") {
    interestPaid = payment < interest ? payment : interest;
    principalPaid = payment - interestPaid;
  } else {
    principalPaid = payment < principal ? payment : principal;
    interestPaid = payment - principalPaid;
  }

  return {
    interestPaid: fromCents(interestPaid),
    principalPaid: fromCents(principalPaid),
    remainingInterest: fromCents(interest - interestPaid),
    remainingPrincipal: fromCents(principal - principalPaid),
    totalAllocated: fromCents(interestPaid + principalPaid),
  };
}
