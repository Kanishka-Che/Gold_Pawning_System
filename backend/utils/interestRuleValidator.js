
export const INTEREST_PRINCIPAL_METHODS = Object.freeze({
  ORIGINAL: "original_principal",
  REMAINING: "remaining_principal",
});

export function validateInterestPrincipalMethod(method) {
  const allowedMethods = Object.values(
    INTEREST_PRINCIPAL_METHODS
  );

  if (
    typeof method !== "string" ||
    !allowedMethods.includes(method)
  ) {
    throw new Error(
      "Invalid or unconfirmed interest principal method"
    );
  }

  return method;
}

export function getInterestPrincipalBase({
  originalPrincipal,
  outstandingPrincipal,
  method,
}) {
  validateInterestPrincipalMethod(method);

  const validAmount = (value) =>
    (typeof value === "number" ||
      typeof value === "string") &&
    /^\d+(\.\d{1,2})?$/.test(String(value)) &&
    BigInt(String(value).split(".")[0]) * 100n +
      BigInt(
        (String(value).split(".")[1] ?? "")
          .padEnd(2, "0")
      ) <= BigInt(Number.MAX_SAFE_INTEGER);

  if (
    !validAmount(originalPrincipal) ||
    !validAmount(outstandingPrincipal)
  ) {
    throw new Error("Invalid principal amounts");
  }

  const original = Number(originalPrincipal);
  const outstanding = Number(outstandingPrincipal);

  if (outstanding > original) {
    throw new Error(
      "Outstanding principal exceeds original principal"
    );
  }

  return method === INTEREST_PRINCIPAL_METHODS.ORIGINAL
    ? originalPrincipal
    : outstandingPrincipal;
}
