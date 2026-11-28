import { isValidMoney } from "./moneyValidator.js";

import {
  parseLegacyCalendarDate,
} from "./legacyLoanValidator.js";


export class OpeningBalanceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);

    this.name = "OpeningBalanceError";
    this.statusCode = statusCode;
  }
}


// Convert validated monetary values into exact cents
const toCents = (amount) => {
  const [whole, fraction = ""] =
    String(amount).split(".");

  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"))
  );
};


// Convert exact cents back into a safe monetary value
const fromCents = (cents) => {
  if (
    cents < 0n ||
    cents > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new OpeningBalanceError(
      "Opening balance exceeds supported monetary range"
    );
  }

  const amount = Number(cents) / 100;

  if (
    !isValidMoney(amount, { allowZero: true }) ||
    toCents(amount) !== cents
  ) {
    throw new OpeningBalanceError(
      "Opening balance cannot be represented accurately"
    );
  }

  return amount;
};


// Validate expected opening balance version
export const validateOpeningBalanceVersion = (
  version
) => {
  if (
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    throw new OpeningBalanceError(
      "Invalid expected opening balance version"
    );
  }

  return version;
};


// Validate opening balance request
export const validateOpeningBalanceInput = (
  input,
  loan
) => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new OpeningBalanceError(
      "Invalid opening balance data"
    );
  }

  const allowedFields = [
    "asOfDate",
    "principalPaid",
    "outstandingInterest",
    "expectedVersion",
  ];

  if (
    Object.keys(input).some(
      (field) => !allowedFields.includes(field)
    )
  ) {
    throw new OpeningBalanceError(
      "Unsupported opening balance fields"
    );
  }

  const {
    asOfDate,
    principalPaid,
    outstandingInterest,
    expectedVersion,
  } = input;

  validateOpeningBalanceVersion(expectedVersion);

  // Validate original loan principal
  if (!isValidMoney(loan.principalAmount)) {
    throw new OpeningBalanceError(
      "Invalid original loan principal",
      409
    );
  }

  // Validate previously paid principal
  if (
    !isValidMoney(principalPaid, {
      allowZero: true,
    })
  ) {
    throw new OpeningBalanceError(
      "Invalid previously paid principal"
    );
  }

  // Validate historical outstanding interest
  if (
    !isValidMoney(outstandingInterest, {
      allowZero: true,
    })
  ) {
    throw new OpeningBalanceError(
      "Invalid outstanding interest"
    );
  }

  const balanceDate = parseLegacyCalendarDate(
    asOfDate,
    "Opening balance date"
  );

  const issueDate = new Date(loan.issueDate);

  const importedAt = new Date(loan.importedAt);

  if (
    !loan.issueDate ||
    !loan.importedAt ||
    !Number.isFinite(issueDate.getTime()) ||
    !Number.isFinite(importedAt.getTime())
  ) {
    throw new OpeningBalanceError(
      "Invalid legacy loan dates",
      409
    );
  }

  if (balanceDate < issueDate) {
    throw new OpeningBalanceError(
      "Opening balance date cannot be before issue date"
    );
  }

  if (balanceDate > importedAt) {
    throw new OpeningBalanceError(
      "Opening balance date cannot be after import date"
    );
  }

  if (balanceDate > new Date()) {
    throw new OpeningBalanceError(
      "Opening balance date cannot be in the future"
    );
  }

  const originalCents = toCents(
    loan.principalAmount
  );

  const paidCents = toCents(principalPaid);

  const interestCents = toCents(
    outstandingInterest
  );

  if (paidCents > originalCents) {
    throw new OpeningBalanceError(
      "Paid principal cannot exceed original principal"
    );
  }

  const outstandingPrincipalCents =
    originalCents - paidCents;

  const totalOutstandingCents =
    outstandingPrincipalCents + interestCents;

  const outstandingPrincipal = fromCents(
    outstandingPrincipalCents
  );

  const totalOutstanding = fromCents(
    totalOutstandingCents
  );

  return {
    expectedVersion,

    openingBalance: {
      asOfDate: balanceDate,

      principalPaid,

      outstandingPrincipal,

      outstandingInterest,
    },

    totalOutstanding,
  };
};


// Calculate total from stored opening balance
export const calculateOpeningBalanceTotal = (
  balance
) => {
  if (!balance) {
    return null;
  }

  if (
    !isValidMoney(balance.outstandingPrincipal, {
      allowZero: true,
    }) ||
    !isValidMoney(balance.outstandingInterest, {
      allowZero: true,
    })
  ) {
    throw new OpeningBalanceError(
      "Invalid stored opening balance",
      409
    );
  }

  return fromCents(
    toCents(balance.outstandingPrincipal) +
    toCents(balance.outstandingInterest)
  );
};