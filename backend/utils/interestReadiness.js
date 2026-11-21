
import {
  validateInterestPrincipalMethod,
} from "./interestRuleValidator.js";

export function validateInterestReadiness(settings) {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    throw new Error("Interest settings are required");
  }

  if (
    settings.calculationMethod !== "monthly" &&
    settings.calculationMethod !== "daily"
  ) {
    throw new Error(
      "Interest calculation method is not confirmed"
    );
  }

  validateInterestPrincipalMethod(
    settings.principalCalculationMethod
  );

  if (
    typeof settings.rate !== "number" ||
    !Number.isFinite(settings.rate) ||
    settings.rate < 0
  ) {
    throw new Error("Invalid interest rate");
  }

  if (
    !Number.isSafeInteger(settings.minimumInterestDays) ||
    settings.minimumInterestDays < 0
  ) {
    throw new Error("Invalid minimum interest days");
  }

  if (
    typeof settings.chargeFullFirstMonth !== "boolean"
  ) {
    throw new Error(
      "Invalid first month interest setting"
    );
  }

  return {
    ready: true,
    calculationMethod: settings.calculationMethod,
    principalCalculationMethod:
      settings.principalCalculationMethod,
  };
}
