import {
  validateLegacyInterestSettings,
  LegacyLoanValidationError,
} from "../utils/legacyLoanValidator.js";


export const buildLegacyLoanSettingsSnapshot = ({
  currentSettings,
  customInterest,
}) => {
  if (
    !currentSettings ||
    !Number.isSafeInteger(currentSettings.version) ||
    currentSettings.version < 1
  ) {
    throw new LegacyLoanValidationError(
      "Valid shop loan settings are required"
    );
  }

  // Use original interest settings,
  // not the current shop interest rate.
  const interest =
    validateLegacyInterestSettings(
      customInterest
    );

  // Do not assume that current business rules
  // apply to historical pawn loans.
  const settingsSnapshot = {
    interest: {
      ...interest,
    },

    // Original maturity date is supplied separately.
    loan: {
      defaultDurationMonths: null,
      maximumLoanAmount: null,
    },

    // Disabled until business rules are confirmed.
    partialPayment: {
      enabled: false,
      allowPartialInterest: false,
      allowPartialPrincipal: false,
      minimumAmount: 0,
    },

    renewal: {
      enabled: false,
      durationMonths: null,
      requireInterestSettlement: true,
      renewalFee: 0,
    },

    redemption: {
      enabled: false,
      allowEarlyRedemption: false,
      allowOverdueRedemption: false,
      includeOverduePenalties: false,
      requireCustomerVerification: true,
      requireAdminApproval: true,
    },

    overdue: {
      gracePeriodDays: 0,
      penaltyEnabled: false,
      penaltyRate: 0,
    },
  };

  return {
    settingsVersion: currentSettings.version,

    interestRate: interest.rate,

    settingsSnapshot,
  };
};