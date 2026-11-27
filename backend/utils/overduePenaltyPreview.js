
export const buildOverduePenaltyPreview = ({
  loan,
  classification,
  balance,
}) => {
  const settings =
    loan?.settingsSnapshot?.overdue;

  const enabled =
    typeof settings?.penaltyEnabled === "boolean"
      ? settings.penaltyEnabled
      : null;

  const rate =
    typeof settings?.penaltyRate === "number" &&
    Number.isFinite(settings.penaltyRate) &&
    settings.penaltyRate >= 0
      ? settings.penaltyRate
      : null;

  const settingsAvailable =
    enabled !== null &&
    rate !== null &&
    Number.isSafeInteger(settings?.gracePeriodDays) &&
    settings.gracePeriodDays >= 0;

  const isOverdue =
    loan?.status === "active" &&
    classification?.classification === "overdue";

  let status;
  let message;

  if (!settingsAvailable) {
    status = "missing_settings";
    message =
      "Valid overdue settings are not available in the loan snapshot.";
  } else if (enabled === false) {
    status = "disabled";
    message =
      "Penalties are disabled in this loan's settings snapshot.";
  } else if (
    classification?.classification === "unclassified"
  ) {
    status = "classification_unavailable";
    message =
      "The loan overdue classification is unavailable.";
  } else if (!isOverdue) {
    status = "not_applicable";
    message =
      "The loan is not overdue beyond its grace period.";
  } else if (!balance) {
    status = "balance_unavailable";
    message =
      "A valid outstanding principal balance is unavailable.";
  } else {
    status = "rules_unconfirmed";
    message =
      "Penalty calculation rules must be confirmed before calculating an amount.";
  }

  return {
    enabled,
    rate,
    settingsAvailable,

    status,
    message,

    daysAfterGrace:
      classification?.daysAfterGrace ?? null,

    originalPrincipal:
      balance?.originalPrincipal ?? null,

    outstandingPrincipal:
      balance?.outstandingPrincipal ?? null,

    calculationMethod: null,
    calculationBase: null,

    calculated: false,
    amount: null,

    currency: "LKR",

    requiresBusinessRuleConfirmation: true,

    isFinalPenaltyAmount: false,
    postingEnabled: false,
  };
};
