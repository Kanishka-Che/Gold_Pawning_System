import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import GoldItem from "../models/GoldItem.js";
import LoanSettings from "../models/LoanSettings.js";

import {
  normalizeLegacyTicketNumber,
  normalizeLegacyReference,
  validateLegacyLoanDates,
  validateLegacyPrincipal,
  validateLegacyInterestSettings,
  LegacyLoanValidationError,
} from "../utils/legacyLoanValidator.js";

import {
  validateLegacyLoanCustomer,
} from "./legacyCustomerService.js";

import {
  buildLegacyLoanSettingsSnapshot,
} from "./legacyLoanSettingsService.js";

import {
  generateLoanNumber,
} from "../utils/generateLoanNumber.js";

import {
  createAuditLog,
} from "../utils/auditLogger.js";


export class LegacyPawnLoanError extends Error {
  constructor(message, statusCode = 400) {
    super(message);

    this.name = "LegacyPawnLoanError";
    this.statusCode = statusCode;
  }
}


// Validate MongoDB ObjectId
const isValidId = (value) =>
  typeof value === "string" &&
  mongoose.isObjectIdOrHexString(value);


// Validate legacy loan request
export const validateLegacyPawnLoanInput = (
  input
) => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new LegacyLoanValidationError(
      "Invalid legacy pawn loan data"
    );
  }

  const allowedFields = [
    "customerId",
    "goldItemIds",
    "principalAmount",
    "legacyTicketNumber",
    "legacyReference",
    "legacyHistoryMode",
    "issueDate",
    "maturityDate",
    "customInterest",
  ];

  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) {
      throw new LegacyLoanValidationError(
        `Unsupported legacy loan field: ${field}`
      );
    }
  }

  const {
    customerId,
    goldItemIds,
    principalAmount,
    legacyTicketNumber,
    legacyReference,
    legacyHistoryMode,
    issueDate,
    maturityDate,
    customInterest,
  } = input;

  // Validate customer
  if (!isValidId(customerId)) {
    throw new LegacyLoanValidationError(
      "Invalid customer ID"
    );
  }

  // Validate gold items
  if (
    !Array.isArray(goldItemIds) ||
    goldItemIds.length < 1 ||
    goldItemIds.length > 50 ||
    !goldItemIds.every(isValidId)
  ) {
    throw new LegacyLoanValidationError(
      "Select between 1 and 50 valid gold items"
    );
  }

  const normalizedGoldItemIds =
    goldItemIds.map((id) => id.toLowerCase());

  if (
    new Set(normalizedGoldItemIds).size !==
    normalizedGoldItemIds.length
  ) {
    throw new LegacyLoanValidationError(
      "Duplicate gold items are not allowed"
    );
  }

  // Validate historical migration method
  if (
    !["full_history", "opening_balance"].includes(
      legacyHistoryMode
    )
  ) {
    throw new LegacyLoanValidationError(
      "Invalid legacy history mode"
    );
  }

  const importedAt = new Date();

  const dates = validateLegacyLoanDates({
    issueDate,
    maturityDate,
    importedAt,
  });

  return {
    customerId: customerId.toLowerCase(),

    goldItemIds: normalizedGoldItemIds,

    principalAmount:
      validateLegacyPrincipal(principalAmount),

    legacyTicketNumber:
      normalizeLegacyTicketNumber(
        legacyTicketNumber
      ),

    legacyReference:
      normalizeLegacyReference(legacyReference),

    legacyHistoryMode,

    issueDate: dates.issueDate,

    maturityDate: dates.maturityDate,

    importedAt,

    customInterest:
      validateLegacyInterestSettings(
        customInterest
      ),
  };
};


// Create legacy draft within database transaction
export const createLegacyPawnLoanDraft = async ({
  req,
  input,
  session,
}) => {
  // Defense-in-depth authorization
  if (
    !req.user?._id ||
    req.user.role !== "admin"
  ) {
    throw new LegacyPawnLoanError(
      "Only administrators can import legacy pawn loans",
      403
    );
  }

  if (!session || !session.inTransaction()) {
    throw new Error(
      "Active database transaction is required"
    );
  }

  const data =
    validateLegacyPawnLoanInput(input);

  // 1. Validate existing customer
  const customer =
    await validateLegacyLoanCustomer({
      customerId: data.customerId,
      session,
    });

  // 2. Check duplicate original ticket number
  const existingLoan = await PawnLoan.findOne({
    recordSource: "legacy",
    legacyTicketNumber: data.legacyTicketNumber,
  })
    .select("_id")
    .session(session)
    .lean();

  if (existingLoan) {
    throw new LegacyPawnLoanError(
      "Original pawn ticket number is already registered",
      409
    );
  }

  // 3. Load current settings revision
  const currentSettings =
    await LoanSettings.findOne({
      settingsKey: "default",
    }).session(session);

  if (!currentSettings) {
    throw new LegacyPawnLoanError(
      "Shop loan settings must be configured first",
      409
    );
  }

  // 4. Build independent historical settings
  const snapshot =
    buildLegacyLoanSettingsSnapshot({
      currentSettings,
      customInterest: data.customInterest,
    });

  // 5. Generate internal loan number
  const loanNumber =
    await generateLoanNumber(session);

  // 6. Create legacy draft
  const [loan] = await PawnLoan.create(
    [
      {
        loanNumber,

        recordSource: "legacy",

        settingsSource: "legacy_custom",

        legacyRulesStatus: "pending",

        legacyMigrationStatus: "pending",

        legacyTicketNumber:
          data.legacyTicketNumber,

        legacyReference:
          data.legacyReference,

        legacyHistoryMode:
          data.legacyHistoryMode,

        importedAt: data.importedAt,

        importedBy: req.user._id,

        customer: customer._id,

        goldItems: data.goldItemIds,

        principalAmount: data.principalAmount,

        currency: "LKR",

        interestRate: snapshot.interestRate,

        issueDate: data.issueDate,

        maturityDate: data.maturityDate,

        status: "draft",

        settingsVersion:
          snapshot.settingsVersion,

        settingsSnapshot:
          snapshot.settingsSnapshot,

        createdBy: req.user._id,
      },
    ],
    { session }
  );

  // 7. Reserve gold items atomically
  const reservation = await GoldItem.updateMany(
    {
      _id: {
        $in: data.goldItemIds,
      },

      status: "draft",

      reservedForLoan: null,
    },
    {
      $set: {
        reservedForLoan: loan._id,
      },
    },
    { session }
  );

  if (
    reservation.modifiedCount !==
    data.goldItemIds.length
  ) {
    throw new LegacyPawnLoanError(
      "One or more gold items are unavailable",
      409
    );
  }

  // 8. Record audit event
  await createAuditLog({
    req,

    action: "LEGACY_PAWN_LOAN_CREATED",

    targetType: "PawnLoan",

    targetId: loan._id,

    details: {
      loanNumber: loan.loanNumber,

      legacyTicketNumber:
        loan.legacyTicketNumber,

      customerId: String(customer._id),

      goldItemIds:
        data.goldItemIds.map(String),

      principalAmount:
        loan.principalAmount,

      currency: loan.currency,

      interestRate: loan.interestRate,

      issueDate: loan.issueDate,

      maturityDate: loan.maturityDate,

      importedAt: loan.importedAt,

      legacyHistoryMode:
        loan.legacyHistoryMode,

      legacyMigrationStatus:
        loan.legacyMigrationStatus,

      settingsVersion:
        loan.settingsVersion,

      status: loan.status,
    },

    session,
  });

  return loan;
};