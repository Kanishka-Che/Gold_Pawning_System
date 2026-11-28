
import {
  isValidMoney,
} from "./moneyValidator.js";

import {
  validateSupportedInterestSettings,
} from "./interestSettingsValidator.js";

import {
  toSriLankaCalendarDay,
} from "./renewalDateCalculator.js";

export class LegacyInterestError extends Error {
  constructor(message, statusCode = 409) {
    super(message);

    this.name = "LegacyInterestError";
    this.statusCode = statusCode;
  }
}

export const validateLegacyInterestLoan = ({
  loan,
  calculationDate,
}) => {
  if (!loan) {
    throw new LegacyInterestError(
      "Pawn loan not found",
      404
    );
  }

  if (loan.recordSource !== "legacy") {
    throw new LegacyInterestError(
      "Legacy pawn loan is required"
    );
  }

  if (
    !["draft", "active"].includes(loan.status)
  ) {
    throw new LegacyInterestError(
      "Loan is not eligible for interest preview"
    );
  }

  if (
    !["verified", "completed"].includes(
      loan.legacyMigrationStatus
    )
  ) {
    throw new LegacyInterestError(
      "Historical financial data must be verified first"
    );
  }

  if (
    !["full_history", "opening_balance"].includes(
      loan.legacyHistoryMode
    )
  ) {
    throw new LegacyInterestError(
      "Invalid legacy history mode"
    );
  }

  if (!isValidMoney(loan.principalAmount)) {
    throw new LegacyInterestError(
      "Invalid original principal amount"
    );
  }

  const interestSettings =
    loan.settingsSnapshot?.interest;

  try {
    validateSupportedInterestSettings(
      interestSettings
    );
  } catch (error) {
    throw new LegacyInterestError(error.message);
  }

  if (
    loan.interestRate !== interestSettings.rate
  ) {
    throw new LegacyInterestError(
      "Legacy interest settings are inconsistent"
    );
  }

  if (
    calculationDate == null ||
    !Number.isFinite(
      new Date(calculationDate).getTime()
    )
  ) {
    throw new LegacyInterestError(
      "Invalid calculation date",
      400
    );
  }

  const calculationDay =
    toSriLankaCalendarDay(calculationDate);

  const issueDay =
    toSriLankaCalendarDay(loan.issueDate);

  const importDay =
    toSriLankaCalendarDay(loan.importedAt);

  const today =
    toSriLankaCalendarDay(new Date());

  if (
    calculationDay < issueDay ||
    calculationDay < importDay ||
    calculationDay > today
  ) {
    throw new LegacyInterestError(
      "Calculation date must be between import date and today",
      400
    );
  }

  return interestSettings;
};

export const validateLegacyOpeningBalance =
  (loan) => {
    const balance = loan.openingBalance;

    if (
      !balance ||
      !loan.openingBalanceVerifiedAt ||
      !loan.openingBalanceVerifiedBy ||
      !Number.isSafeInteger(
        loan.openingBalanceVersion
      ) ||
      loan.openingBalanceVersion < 1
    ) {
      throw new LegacyInterestError(
        "Verified opening balance is required"
      );
    }

    const fields = [
      "principalPaid",
      "outstandingPrincipal",
      "outstandingInterest",
    ];

    for (const field of fields) {
      if (
        !isValidMoney(balance[field], {
          allowZero: true,
        })
      ) {
        throw new LegacyInterestError(
          `Invalid opening balance ${field}`
        );
      }
    }

    const balanceDay =
      toSriLankaCalendarDay(balance.asOfDate);

    const issueDay =
      toSriLankaCalendarDay(loan.issueDate);

    const importDay =
      toSriLankaCalendarDay(loan.importedAt);

    if (
      balanceDay < issueDay ||
      balanceDay > importDay
    ) {
      throw new LegacyInterestError(
        "Invalid opening balance date"
      );
    }

    return balance;
  };
