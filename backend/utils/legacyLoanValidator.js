import { isValidMoney } from "./moneyValidator.js";

import {
  validateSupportedInterestSettings,
} from "./interestSettingsValidator.js";

import {
  toSriLankaCalendarDay,
} from "./renewalDateCalculator.js";


// Legacy loan validation error
export class LegacyLoanValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LegacyLoanValidationError";
    this.statusCode = 400;
  }
}


// Validate and normalize legacy ticket number
export const normalizeLegacyTicketNumber = (value) => {
  if (typeof value !== "string") {
    throw new LegacyLoanValidationError(
      "Original pawn ticket number is required"
    );
  }

  const ticketNumber = value.trim().toUpperCase();

  if (
    ticketNumber.length === 0 ||
    ticketNumber.length > 100
  ) {
    throw new LegacyLoanValidationError(
      "Original pawn ticket number must contain 1 to 100 characters"
    );
  }

  return ticketNumber;
};


// Validate optional legacy reference
export const normalizeLegacyReference = (value) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new LegacyLoanValidationError(
      "Invalid legacy reference"
    );
  }

  const reference = value.trim();

  if (reference.length > 500) {
    throw new LegacyLoanValidationError(
      "Legacy reference cannot exceed 500 characters"
    );
  }

  return reference || undefined;
};


// Convert YYYY-MM-DD into Sri Lanka local midnight
export const parseLegacyCalendarDate = (
  value,
  fieldName = "Date"
) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new LegacyLoanValidationError(
      `${fieldName} must use YYYY-MM-DD format`
    );
  }

  const date = new Date(
    `${value}T00:00:00.000+05:30`
  );

  if (!Number.isFinite(date.getTime())) {
    throw new LegacyLoanValidationError(
      `${fieldName} is invalid`
    );
  }

  // Convert back to Sri Lanka local date
  // to reject invalid dates such as February 30.
  const localDate = new Date(
    date.getTime() + 330 * 60 * 1000
  );

  const normalizedDate = localDate
    .toISOString()
    .slice(0, 10);

  if (normalizedDate !== value) {
    throw new LegacyLoanValidationError(
      `${fieldName} is not a valid calendar date`
    );
  }

  return date;
};


// Validate original loan dates
export const validateLegacyLoanDates = ({
  issueDate,
  maturityDate,
  importedAt = new Date(),
}) => {
  const originalIssueDate =
    parseLegacyCalendarDate(
      issueDate,
      "Original issue date"
    );

  const originalMaturityDate =
    parseLegacyCalendarDate(
      maturityDate,
      "Original maturity date"
    );

  const issueDay =
    toSriLankaCalendarDay(originalIssueDate);

  const maturityDay =
    toSriLankaCalendarDay(originalMaturityDate);

  const importDay =
    toSriLankaCalendarDay(importedAt);

  if (issueDay > importDay) {
    throw new LegacyLoanValidationError(
      "Original issue date cannot be in the future"
    );
  }

  if (maturityDay <= issueDay) {
    throw new LegacyLoanValidationError(
      "Original maturity date must be after issue date"
    );
  }

  return {
    issueDate: originalIssueDate,
    maturityDate: originalMaturityDate,
  };
};


// Validate original principal
export const validateLegacyPrincipal = (amount) => {
  if (!isValidMoney(amount)) {
    throw new LegacyLoanValidationError(
      "Invalid original principal amount"
    );
  }

  return amount;
};


// Validate explicitly provided interest settings
export const validateLegacyInterestSettings = (
  settings
) => {
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    throw new LegacyLoanValidationError(
      "Original interest settings are required"
    );
  }

  const allowedFields = [
    "rate",
    "calculationMethod",
    "principalCalculationMethod",
    "minimumInterestDays",
    "chargeFullFirstMonth",
  ];

  for (const field of Object.keys(settings)) {
    if (!allowedFields.includes(field)) {
      throw new LegacyLoanValidationError(
        `Unsupported interest setting: ${field}`
      );
    }
  }

  const interestSettings = {
    rate: settings.rate,

    calculationMethod:
      settings.calculationMethod,

    principalCalculationMethod:
      settings.principalCalculationMethod,

    minimumInterestDays:
      settings.minimumInterestDays,

    chargeFullFirstMonth:
      settings.chargeFullFirstMonth,
  };

  try {
    validateSupportedInterestSettings(
      interestSettings
    );
  } catch (error) {
    throw new LegacyLoanValidationError(
      error.message
    );
  }

  return interestSettings;
};