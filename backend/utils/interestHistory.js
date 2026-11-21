
import {
  buildPrincipalHistory,
} from "./principalHistory.js";

import {
  validateInterestPrincipalMethod,
} from "./interestRuleValidator.js";

export function buildInterestHistory({
  originalPrincipal,
  issueDate,
  calculationDate,
  payments,
  principalCalculationMethod,
}) {
  // Never silently select an unconfirmed rule.
  validateInterestPrincipalMethod(
    principalCalculationMethod
  );

  const history = buildPrincipalHistory({
    originalPrincipal,
    issueDate,
    calculationDate,
    payments,
  });

  const periods = history.periods.map((period) => ({
    from: period.from,
    to: period.to,
    outstandingPrincipal: period.principal,

    interestPrincipal:
      principalCalculationMethod === "original_principal"
        ? history.originalPrincipal
        : period.principal,
  }));

  return {
    principalCalculationMethod,
    originalPrincipal: history.originalPrincipal,
    outstandingPrincipal:
      history.outstandingPrincipal,
    periods,
  };
}
