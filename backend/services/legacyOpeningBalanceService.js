import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

import {
  OpeningBalanceError,
  validateOpeningBalanceInput,
  validateOpeningBalanceVersion,
  calculateOpeningBalanceTotal,
} from "../utils/openingBalanceValidator.js";

import {
  createAuditLog,
} from "../utils/auditLogger.js";


// Validate administrator access
const requireAdmin = (req) => {
  if (
    !req.user?._id ||
    req.user.role !== "admin"
  ) {
    throw new OpeningBalanceError(
      "Only administrators can manage opening balances",
      403
    );
  }
};


// Validate loan ID
const validateLoanId = (loanId) => {
  if (
    typeof loanId !== "string" ||
    !mongoose.isObjectIdOrHexString(loanId)
  ) {
    throw new OpeningBalanceError(
      "Invalid pawn loan ID"
    );
  }
};


// Require active database transaction
const requireTransaction = (session) => {
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Active database transaction is required"
    );
  }
};


// Find legacy opening balance loan
const findOpeningBalanceLoan = async ({
  loanId,
  session = null,
}) => {
  validateLoanId(loanId);

  const query = PawnLoan.findOne({
    _id: loanId,
    recordSource: "legacy",
  });

  if (session) {
    query.session(session);
  }

  const loan = await query;

  if (!loan) {
    throw new OpeningBalanceError(
      "Legacy pawn loan not found",
      404
    );
  }

  if (
    loan.legacyHistoryMode !== "opening_balance"
  ) {
    throw new OpeningBalanceError(
      "This loan uses full historical transaction migration",
      409
    );
  }

  return loan;
};


// Get current opening balance revision
const getCurrentVersion = (loan) => {
  const version =
    loan.openingBalanceVersion ?? 0;

  validateOpeningBalanceVersion(version);

  return version;
};


// Validate concurrent update version
const checkExpectedVersion = (
  loan,
  expectedVersion
) => {
  validateOpeningBalanceVersion(
    expectedVersion
  );

  const currentVersion =
    getCurrentVersion(loan);

  if (expectedVersion !== currentVersion) {
    throw new OpeningBalanceError(
      "Opening balance has changed. Reload and try again.",
      409
    );
  }

  if (currentVersion >= Number.MAX_SAFE_INTEGER) {
    throw new OpeningBalanceError(
      "Opening balance version limit reached",
      409
    );
  }

  return currentVersion;
};


// Only pending draft balances can be modified
const requireEditableLoan = (loan) => {
  if (loan.status !== "draft") {
    throw new OpeningBalanceError(
      "Only draft legacy loans can be modified",
      409
    );
  }

  if (loan.legacyMigrationStatus !== "pending") {
    throw new OpeningBalanceError(
      "Verified or completed opening balances cannot be modified",
      409
    );
  }
};


// Prepare API response
const buildOpeningBalanceResponse = (loan) => {
  const balance = loan.openingBalance
    ? loan.openingBalance.toObject()
    : null;

  const canEdit =
    loan.status === "draft" &&
    loan.legacyMigrationStatus === "pending";

  return {
    pawnLoanId: String(loan._id),

    loanNumber: loan.loanNumber,

    legacyTicketNumber:
      loan.legacyTicketNumber,

    legacyHistoryMode:
      loan.legacyHistoryMode,

    principalAmount:
      loan.principalAmount,

    currency: loan.currency,

    issueDate: loan.issueDate,

    maturityDate: loan.maturityDate,

    importedAt: loan.importedAt,

    status: loan.status,

    legacyMigrationStatus:
      loan.legacyMigrationStatus,

    openingBalanceVersion:
      getCurrentVersion(loan),

    openingBalance: balance,

    totalOutstanding:
      calculateOpeningBalanceTotal(balance),

    verifiedAt:
      loan.openingBalanceVerifiedAt ?? null,

    verifiedBy:
      loan.openingBalanceVerifiedBy ?? null,

    canEdit,

    canVerify:
      canEdit && balance !== null,

    canActivate: false,
  };
};


// Compare two opening balances
const balancesAreEqual = (
  previous,
  next
) => {
  if (!previous || !next) {
    return false;
  }

  return (
    new Date(previous.asOfDate).getTime() ===
      new Date(next.asOfDate).getTime() &&

    previous.principalPaid ===
      next.principalPaid &&

    previous.outstandingPrincipal ===
      next.outstandingPrincipal &&

    previous.outstandingInterest ===
      next.outstandingInterest
  );
};


// Read opening balance information
export const getLegacyOpeningBalanceData = async ({
  req,
  loanId,
}) => {
  requireAdmin(req);

  const loan = await findOpeningBalanceLoan({
    loanId,
  });

  return buildOpeningBalanceResponse(loan);
};


// Create or update pending opening balance
export const saveLegacyOpeningBalance = async ({
  req,
  loanId,
  input,
  session,
}) => {
  requireAdmin(req);

  requireTransaction(session);

  const loan = await findOpeningBalanceLoan({
    loanId,
    session,
  });

  requireEditableLoan(loan);

  const validated =
    validateOpeningBalanceInput(input, loan);

  const currentVersion = checkExpectedVersion(
    loan,
    validated.expectedVersion
  );

  const previousBalance = loan.openingBalance
    ? loan.openingBalance.toObject()
    : null;

  // No changes: do not increment version
  // or create unnecessary audit records.
  if (
    balancesAreEqual(
      previousBalance,
      validated.openingBalance
    )
  ) {
    return {
      changed: false,

      data: buildOpeningBalanceResponse(loan),
    };
  }

  // Save pending balance
  loan.openingBalance =
    validated.openingBalance;

  loan.openingBalanceVersion =
    currentVersion + 1;

  await loan.save({ session });

  // Record audit event
  await createAuditLog({
    req,

    action: previousBalance
      ? "LEGACY_OPENING_BALANCE_UPDATED"
      : "LEGACY_OPENING_BALANCE_CREATED",

    targetType: "PawnLoan",

    targetId: loan._id,

    details: {
      loanNumber: loan.loanNumber,

      legacyTicketNumber:
        loan.legacyTicketNumber,

      previousBalance,

      newBalance:
        loan.openingBalance.toObject(),

      previousVersion: currentVersion,

      newVersion:
        loan.openingBalanceVersion,

      totalOutstanding:
        validated.totalOutstanding,

      legacyMigrationStatus:
        loan.legacyMigrationStatus,
    },

    session,
  });

  return {
    changed: true,

    data: buildOpeningBalanceResponse(loan),
  };
};


// Verify opening balance against historical records
export const verifyLegacyOpeningBalance = async ({
  req,
  loanId,
  input,
  session,
}) => {
  requireAdmin(req);

  requireTransaction(session);

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (field) =>
        ![
          "expectedVersion",
          "confirmVerification",
        ].includes(field)
    )
  ) {
    throw new OpeningBalanceError(
      "Invalid opening balance verification data"
    );
  }

  if (input.confirmVerification !== true) {
    throw new OpeningBalanceError(
      "Historical balance verification must be confirmed"
    );
  }

  const loan = await findOpeningBalanceLoan({
    loanId,
    session,
  });

  requireEditableLoan(loan);

  const currentVersion = checkExpectedVersion(
    loan,
    input.expectedVersion
  );

  if (!loan.openingBalance) {
    throw new OpeningBalanceError(
      "Opening balance must be entered before verification",
      409
    );
  }

  // Revalidate stored balance before verification
  const storedBalance =
    loan.openingBalance.toObject();

  const sriLankaDate = new Date(
    new Date(storedBalance.asOfDate).getTime() +
      330 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const validated =
    validateOpeningBalanceInput(
      {
        asOfDate: sriLankaDate,

        principalPaid:
          storedBalance.principalPaid,

        outstandingInterest:
          storedBalance.outstandingInterest,

        expectedVersion: currentVersion,
      },
      loan
    );

  if (
    !balancesAreEqual(
      storedBalance,
      validated.openingBalance
    )
  ) {
    throw new OpeningBalanceError(
      "Stored opening balance is inconsistent",
      409
    );
  }

  // Fully settled historical records require
  // a separate migration workflow.
  if (
    validated.openingBalance.outstandingPrincipal === 0
  ) {
    throw new OpeningBalanceError(
      "Loans without outstanding principal require a separate historical migration workflow",
      409
    );
  }

  // Lock balance by changing migration status
  loan.legacyMigrationStatus = "verified";

  loan.openingBalanceVerifiedAt = new Date();

  loan.openingBalanceVerifiedBy =
    req.user._id;

  loan.openingBalanceVersion =
    currentVersion + 1;

  await loan.save({ session });

  // Record verification audit event
  await createAuditLog({
    req,

    action: "LEGACY_OPENING_BALANCE_VERIFIED",

    targetType: "PawnLoan",

    targetId: loan._id,

    details: {
      loanNumber: loan.loanNumber,

      legacyTicketNumber:
        loan.legacyTicketNumber,

      openingBalance:
        loan.openingBalance.toObject(),

      totalOutstanding:
        validated.totalOutstanding,

      previousMigrationStatus: "pending",

      newMigrationStatus: "verified",

      previousVersion: currentVersion,

      newVersion:
        loan.openingBalanceVersion,

      verifiedAt:
        loan.openingBalanceVerifiedAt,

      verifiedBy:
        String(loan.openingBalanceVerifiedBy),
    },

    session,
  });

  return buildOpeningBalanceResponse(loan);
};