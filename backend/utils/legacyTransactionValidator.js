import mongoose from "mongoose";

import {
  isValidMoney,
} from "./moneyValidator.js";

import {
  parseLegacyCalendarDate,
} from "./legacyLoanValidator.js";

import {
  toSriLankaCalendarDay,
} from "./renewalDateCalculator.js";


export class LegacyTransactionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);

    this.name = "LegacyTransactionError";
    this.statusCode = statusCode;
  }
}


export const isValidId = (value) =>
  typeof value === "string" &&
  mongoose.isObjectIdOrHexString(value);


export const validateRequestFields = (
  input,
  allowedFields
) => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new LegacyTransactionError(
      "Invalid request data"
    );
  }

  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) {
      throw new LegacyTransactionError(
        `Unsupported field: ${field}`
      );
    }
  }
};


export const validateHistoryVersion = (value) => {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    throw new LegacyTransactionError(
      "Invalid historical transaction version"
    );
  }

  return value;
};


export const validateTransactionText = (
  value,
  field,
  maxLength = 500
) => {
  if (
    typeof value !== "string" ||
    value.trim().length > maxLength
  ) {
    throw new LegacyTransactionError(
      `Invalid ${field}`
    );
  }

  return value.trim();
};


export const validateIdempotencyKey = (value) => {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new LegacyTransactionError(
      "Invalid idempotency key"
    );
  }

  return value;
};


export const toMoneyCents = (value) => {
  if (
    !isValidMoney(value, {
      allowZero: true,
    })
  ) {
    throw new LegacyTransactionError(
      "Invalid monetary amount"
    );
  }

  const [whole, fraction = ""] =
    String(value).split(".");

  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"))
  );
};


export const fromMoneyCents = (value) => {
  if (
    value < 0n ||
    value > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new LegacyTransactionError(
      "Monetary amount exceeds supported range"
    );
  }

  const amount = Number(value) / 100;

  if (toMoneyCents(amount) !== value) {
    throw new LegacyTransactionError(
      "Monetary precision cannot be preserved"
    );
  }

  return amount;
};


export const validateLegacyTransactionInput = (
  input,
  loan
) => {
  validateRequestFields(input, [
    "transactionType",
    "transactionDate",
    "sequenceNumber",
    "historicalReference",
    "paymentMethod",
    "amount",
    "principalPaid",
    "interestPaid",
    "renewalFeePaid",
    "previousMaturityDate",
    "newMaturityDate",
    "notes",
  ]);

  const {
    transactionType,
    transactionDate,
    sequenceNumber,
    historicalReference = "",
    paymentMethod,
    amount,
    principalPaid,
    interestPaid,
    renewalFeePaid,
    previousMaturityDate,
    newMaturityDate,
    notes = "",
  } = input;

  if (
    !["payment", "renewal"].includes(
      transactionType
    )
  ) {
    throw new LegacyTransactionError(
      "Invalid transaction type"
    );
  }

  if (
    !Number.isSafeInteger(sequenceNumber) ||
    sequenceNumber < 1
  ) {
    throw new LegacyTransactionError(
      "Invalid transaction sequence number"
    );
  }

  const date = parseLegacyCalendarDate(
    transactionDate,
    "Transaction date"
  );

  const transactionDay =
    toSriLankaCalendarDay(date);

  const issueDay =
    toSriLankaCalendarDay(loan.issueDate);

  const importDay =
    toSriLankaCalendarDay(loan.importedAt);

  if (
    transactionDay < issueDay ||
    transactionDay > importDay
  ) {
    throw new LegacyTransactionError(
      "Transaction date must be between original issue date and import date"
    );
  }

  const amountCents = toMoneyCents(amount);

  const principalCents =
    toMoneyCents(principalPaid);

  const interestCents =
    toMoneyCents(interestPaid);

  const feeCents =
    toMoneyCents(renewalFeePaid);

  if (
    amountCents !==
    principalCents + interestCents + feeCents
  ) {
    throw new LegacyTransactionError(
      "Transaction amount does not match allocation"
    );
  }

  const data = {
    transactionType,
    transactionDate: date,
    sequenceNumber,

    historicalReference:
      validateTransactionText(
        historicalReference,
        "historical reference"
      ),

    amount,
    principalPaid,
    interestPaid,
    renewalFeePaid,

    notes: validateTransactionText(
      notes,
      "notes"
    ),
  };

  if (transactionType === "payment") {
    if (amountCents <= 0n) {
      throw new LegacyTransactionError(
        "Payment amount must be greater than zero"
      );
    }

    if (
      ![
        "cash",
        "bank_transfer",
        "unknown",
      ].includes(paymentMethod)
    ) {
      throw new LegacyTransactionError(
        "Invalid historical payment method"
      );
    }

    if (feeCents !== 0n) {
      throw new LegacyTransactionError(
        "Payment cannot include renewal fees"
      );
    }

    if (
      previousMaturityDate != null ||
      newMaturityDate != null
    ) {
      throw new LegacyTransactionError(
        "Payment cannot contain renewal dates"
      );
    }

    data.paymentMethod = paymentMethod;
  }

  if (transactionType === "renewal") {
    if (principalCents !== 0n) {
      throw new LegacyTransactionError(
        "Renewal cannot contain principal payments"
      );
    }

    if (paymentMethod != null) {
      throw new LegacyTransactionError(
        "Payment method is not supported for renewals"
      );
    }

    const previousDate =
      parseLegacyCalendarDate(
        previousMaturityDate,
        "Previous maturity date"
      );

    const newDate =
      parseLegacyCalendarDate(
        newMaturityDate,
        "New maturity date"
      );

    if (
      toSriLankaCalendarDay(previousDate) <=
      issueDay
    ) {
      throw new LegacyTransactionError(
        "Previous maturity must be after issue date"
      );
    }

    if (
      toSriLankaCalendarDay(newDate) <=
      toSriLankaCalendarDay(previousDate)
    ) {
      throw new LegacyTransactionError(
        "New maturity must be after previous maturity"
      );
    }

    if (
      toSriLankaCalendarDay(newDate) <=
      transactionDay
    ) {
      throw new LegacyTransactionError(
        "New maturity must be after renewal date"
      );
    }

    data.previousMaturityDate = previousDate;
    data.newMaturityDate = newDate;
  }

  return data;
};

export const validateLegacyHistory = ({
  loan,
  transactions,
}) => {
  const activeTransactions = transactions
    .filter((item) => item.status !== "voided")
    .sort(
      (a, b) =>
        a.sequenceNumber - b.sequenceNumber
    );

  const originalPrincipal =
    toMoneyCents(loan.principalAmount);

  let totalPrincipal = 0n;
  let paymentInterest = 0n;
  let renewalInterest = 0n;
  let totalRenewalFees = 0n;

  let previousTransactionDay = null;

  let currentMaturityDay =
    toSriLankaCalendarDay(
      loan.maturityDate
    );

  let effectiveMaturityDate =
    loan.maturityDate;

  let paymentCount = 0;
  let renewalCount = 0;

  const sequences = new Set();
  const references = new Set();

  for (const item of activeTransactions) {
    const day = toSriLankaCalendarDay(
      item.transactionDate
    );

    if (
      day <
        toSriLankaCalendarDay(loan.issueDate) ||
      day >
        toSriLankaCalendarDay(loan.importedAt)
    ) {
      throw new LegacyTransactionError(
        "Historical transaction date is outside the allowed period",
        409
      );
    }

    if (sequences.has(item.sequenceNumber)) {
      throw new LegacyTransactionError(
        "Duplicate historical sequence number",
        409
      );
    }

    sequences.add(item.sequenceNumber);

    if (
      previousTransactionDay !== null &&
      day < previousTransactionDay
    ) {
      throw new LegacyTransactionError(
        "Historical transaction sequence does not match chronological order",
        409
      );
    }

    previousTransactionDay = day;

    // Non-empty original references must be unique
    // within this loan's active historical records.
    const reference =
      item.historicalReference
        ?.trim()
        .toUpperCase();

    if (reference) {
      if (references.has(reference)) {
        throw new LegacyTransactionError(
          "Duplicate historical transaction reference",
          409
        );
      }

      references.add(reference);
    }

    if (item.transactionType === "payment") {
      paymentCount++;

      totalPrincipal += toMoneyCents(
        item.principalPaid
      );

      paymentInterest += toMoneyCents(
        item.interestPaid
      );

      if (totalPrincipal > originalPrincipal) {
        throw new LegacyTransactionError(
          "Historical principal payments exceed original loan amount",
          409
        );
      }
    }

    if (item.transactionType === "renewal") {
      renewalCount++;

      const previousDay =
        toSriLankaCalendarDay(
          item.previousMaturityDate
        );

      const newDay =
        toSriLankaCalendarDay(
          item.newMaturityDate
        );

      if (
        previousDay !== currentMaturityDay ||
        newDay <= previousDay ||
        newDay <= day
      ) {
        throw new LegacyTransactionError(
          "Historical renewal maturity dates do not form a valid chain",
          409
        );
      }

      currentMaturityDay = newDay;

      effectiveMaturityDate =
        item.newMaturityDate;

      renewalInterest += toMoneyCents(
        item.interestPaid
      );

      totalRenewalFees += toMoneyCents(
        item.renewalFeePaid
      );
    }
  }

  const totalInterest =
    paymentInterest + renewalInterest;

  return {
    transactionCount:
      activeTransactions.length,

    paymentCount,
    renewalCount,

    originalPrincipal:
      loan.principalAmount,

    totalPrincipalPaid:
      fromMoneyCents(totalPrincipal),

    outstandingPrincipal:
      fromMoneyCents(
        originalPrincipal - totalPrincipal
      ),

    paymentInterestPaid:
      fromMoneyCents(paymentInterest),

    renewalInterestPaid:
      fromMoneyCents(renewalInterest),

    totalRecordedInterestPaid:
      fromMoneyCents(totalInterest),

    totalRenewalFees:
      fromMoneyCents(totalRenewalFees),

    totalHistoricalAmount:
      fromMoneyCents(
        totalPrincipal +
        totalInterest +
        totalRenewalFees
      ),

    originalMaturityDate:
      loan.maturityDate,

    effectiveMaturityDate,

    outstandingInterest: null,

    isFinalSettlementAmount: false,

    requiresInterestReconciliation: true,
  };
};