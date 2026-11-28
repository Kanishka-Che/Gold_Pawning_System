export function validateSupportedInterestSettings(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    throw new Error("Invalid interest settings");
  }

  const {
    rate,
    calculationMethod,
    principalCalculationMethod,
    minimumInterestDays,
    chargeFullFirstMonth,
  } = settings;

  // Validate monthly interest rate
  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100
  ) {
    throw new Error(
      "Monthly interest rate must be between 0 and 100"
    );
  }

  // Maximum four decimal places
  if (!/^\d+(\.\d{1,4})?$/.test(String(rate))) {
    throw new Error(
      "Interest rate must have at most four decimal places"
    );
  }

  // Validate calculation method
  if (!["monthly", "daily"].includes(calculationMethod)) {
    throw new Error(
      "Invalid interest calculation method"
    );
  }

  // Validate principal calculation method
  if (
    !["original_principal", "remaining_principal"]
      .includes(principalCalculationMethod)
  ) {
    throw new Error(
      "Invalid principal calculation method"
    );
  }

  // Block unsupported combinations
  if (
    calculationMethod === "monthly" &&
    principalCalculationMethod === "remaining_principal"
  ) {
    throw new Error(
      "Monthly remaining principal interest is not yet supported"
    );
  }

  // Block unsupported minimum interest rules
  if (minimumInterestDays !== 0) {
    throw new Error(
      "Minimum interest days must be 0 until this rule is supported"
    );
  }

  // Block unsupported first month rules
  if (chargeFullFirstMonth !== false) {
    throw new Error(
      "Full first month interest is not yet supported"
    );
  }

  return true;
}