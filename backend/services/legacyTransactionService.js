import PawnLoan from "../models/PawnLoan.js";

import LegacyPawnTransaction
  from "../models/LegacyPawnTransaction.js";

import {
  createAuditLog,
} from "../utils/auditLogger.js";

import {
  LegacyTransactionError,
  isValidId,
  validateRequestFields,
  validateHistoryVersion,
  validateTransactionText,
  validateIdempotencyKey,
  validateLegacyTransactionInput,
  validateLegacyHistory,
} from "../utils/legacyTransactionValidator.js";


const MAX_HISTORY_RECORDS = 1000;


const requireAdmin = (req) => {
  if (
    !req.user?._id ||
    req.user.role !== "admin" ||
    req.user.isActive !== true
  ) {
    throw new LegacyTransactionError(
      "Administrator access required",
      403
    );
  }
};


const requireTransaction = (session) => {
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Active database transaction is required"
    );
  }
};


const getHistoryLoan = async ({
  req,
  loanId,
  session,
  editable = false,
}) => {
  requireAdmin(req);
  requireTransaction(session);

  if (!isValidId(loanId)) {
    throw new LegacyTransactionError(
      "Invalid pawn loan ID"
    );
  }

  const loan = await PawnLoan.findOne({
    _id: loanId,
    recordSource: "legacy",
  }).session(session);

  if (!loan) {
    throw new LegacyTransactionError(
      "Legacy pawn loan not found",
      404
    );
  }

  if (
    loan.legacyHistoryMode !== "full_history"
  ) {
    throw new LegacyTransactionError(
      "This loan does not use full history migration",
      409
    );
  }

  if (editable) {
    if (loan.status !== "draft") {
      throw new LegacyTransactionError(
        "Only draft legacy loans can be modified",
        409
      );
    }

    if (
      loan.legacyMigrationStatus !== "pending"
    ) {
      throw new LegacyTransactionError(
        "Verified historical records cannot be modified",
        409
      );
    }
  }

  return loan;
};


const checkVersion = (loan, expectedVersion) => {
  validateHistoryVersion(expectedVersion);

  const currentVersion =
    loan.legacyHistoryVersion ?? 0;

  if (currentVersion !== expectedVersion) {
    throw new LegacyTransactionError(
      "Historical records were modified. Reload and try again.",
      409
    );
  }
};


const loadTransactions = async ({
  loan,
  session,
}) => {
  const transactions =
    await LegacyPawnTransaction.find({
      pawnLoan: loan._id,
    })
      .sort({ sequenceNumber: 1 })
      .limit(MAX_HISTORY_RECORDS + 1)
      .session(session)
      .lean();

  if (
    transactions.length >
    MAX_HISTORY_RECORDS
  ) {
    throw new LegacyTransactionError(
      "Historical record limit exceeded",
      409
    );
  }

  return transactions;
};


const increaseVersion = async ({
  loan,
  session,
}) => {
  const version =
    loan.legacyHistoryVersion ?? 0;

  validateHistoryVersion(version);

  loan.legacyHistoryVersion = version + 1;

  await loan.save({ session });
};


const buildResponse = async ({
  loan,
  session,
}) => {
  const transactions =
    await loadTransactions({
      loan,
      session,
    });

  const summary = validateLegacyHistory({
    loan,
    transactions,
  });

  return {
    loanId: loan._id,
    loanNumber: loan.loanNumber,

    loanStatus: loan.status,

    migrationStatus:
      loan.legacyMigrationStatus,

    historyVersion:
      loan.legacyHistoryVersion ?? 0,

    verifiedAt:
      loan.legacyHistoryVerifiedAt ?? null,

    verifiedBy:
      loan.legacyHistoryVerifiedBy ?? null,

    transactions,
    summary,

    canEdit:
      loan.status === "draft" &&
      loan.legacyMigrationStatus === "pending",

    canActivate: false,
  };
};


// Read historical transactions
export const getLegacyTransactionHistory =
  async ({
    req,
    loanId,
    session,
  }) => {
    const loan = await getHistoryLoan({
      req,
      loanId,
      session,
    });

    return buildResponse({
      loan,
      session,
    });
  };


// Create historical transaction
export const addLegacyTransaction = async ({
  req,
  loanId,
  input,
  session,
}) => {
  validateRequestFields(input, [
    "expectedVersion",
    "idempotencyKey",
    "transaction",
  ]);

  const loan = await getHistoryLoan({
    req,
    loanId,
    session,
    editable: true,
  });

  checkVersion(
    loan,
    input.expectedVersion
  );

  const idempotencyKey =
    validateIdempotencyKey(
      input.idempotencyKey
    );

  const data =
    validateLegacyTransactionInput(
      input.transaction,
      loan
    );

  const duplicate =
    await LegacyPawnTransaction.findOne({
      idempotencyKey,
    })
      .select("_id")
      .session(session)
      .lean();

  if (duplicate) {
    throw new LegacyTransactionError(
      "Historical transaction request already exists. Reload the history.",
      409
    );
  }

  const transactions =
    await loadTransactions({
      loan,
      session,
    });

  if (
    transactions.length >=
    MAX_HISTORY_RECORDS
  ) {
    throw new LegacyTransactionError(
      "Maximum historical record limit reached",
      409
    );
  }

  if (
    transactions.some(
      (item) =>
        item.sequenceNumber ===
        data.sequenceNumber
    )
  ) {
    throw new LegacyTransactionError(
      "Historical sequence number already exists",
      409
    );
  }

  // Validate the entire proposed history.
  validateLegacyHistory({
    loan,
    transactions: [
      ...transactions,
      {
        ...data,
        status: "pending",
      },
    ],
  });

  // Updating the parent loan serializes concurrent
  // history modifications and verification.
  await increaseVersion({
    loan,
    session,
  });

  const [transaction] =
    await LegacyPawnTransaction.create(
      [
        {
          ...data,

          pawnLoan: loan._id,

          idempotencyKey,

          importedBy: req.user._id,

          status: "pending",
        },
      ],
      { session }
    );

  await createAuditLog({
    req,

    action: "LEGACY_TRANSACTION_CREATED",

    targetType: "LegacyPawnTransaction",

    targetId: transaction._id,

    details: {
      pawnLoanId: loan._id,

      loanNumber: loan.loanNumber,

      transactionType:
        transaction.transactionType,

      sequenceNumber:
        transaction.sequenceNumber,

      transactionDate:
        transaction.transactionDate,

      amount: transaction.amount,

      principalPaid:
        transaction.principalPaid,

      interestPaid:
        transaction.interestPaid,

      renewalFeePaid:
        transaction.renewalFeePaid,

      previousMaturityDate:
        transaction.previousMaturityDate,

      newMaturityDate:
        transaction.newMaturityDate,

      historyVersion:
        loan.legacyHistoryVersion,
    },

    session,
  });

  return buildResponse({
    loan,
    session,
  });
};

export const editLegacyTransaction = async ({
  req,
  loanId,
  transactionId,
  input,
  session,
}) => {
  validateRequestFields(input, [
    "expectedVersion",
    "transaction",
  ]);

  if (!isValidId(transactionId)) {
    throw new LegacyTransactionError(
      "Invalid historical transaction ID"
    );
  }

  const loan = await getHistoryLoan({
    req,
    loanId,
    session,
    editable: true,
  });

  checkVersion(
    loan,
    input.expectedVersion
  );

  const transaction =
    await LegacyPawnTransaction.findOne({
      _id: transactionId,
      pawnLoan: loan._id,
    }).session(session);

  if (!transaction) {
    throw new LegacyTransactionError(
      "Historical transaction not found",
      404
    );
  }

  if (transaction.status !== "pending") {
    throw new LegacyTransactionError(
      "Only pending transactions can be edited",
      409
    );
  }

  const data =
    validateLegacyTransactionInput(
      input.transaction,
      loan
    );

  if (
    data.transactionType !==
    transaction.transactionType
  ) {
    throw new LegacyTransactionError(
      "Transaction type cannot be changed",
      409
    );
  }

  const transactions =
    await loadTransactions({
      loan,
      session,
    });

  if (
    transactions.some(
      (item) =>
        String(item._id) !==
          String(transaction._id) &&
        item.sequenceNumber ===
          data.sequenceNumber
    )
  ) {
    throw new LegacyTransactionError(
      "Historical sequence number already exists",
      409
    );
  }

  const proposedTransactions =
    transactions.map((item) =>
      String(item._id) ===
      String(transaction._id)
        ? {
            ...item,
            ...data,
          }
        : item
    );

  validateLegacyHistory({
    loan,
    transactions: proposedTransactions,
  });

  const previousValues = {};

  const changes = {};

  for (const field of Object.keys(data)) {
    const previous = transaction.get(field);

    const next = data[field];

    if (
      JSON.stringify(previous) !==
      JSON.stringify(next)
    ) {
      previousValues[field] =
        previous ?? null;

      changes[field] = {
        old: previous ?? null,
        new: next ?? null,
      };
    }
  }

  if (Object.keys(changes).length === 0) {
    return buildResponse({
      loan,
      session,
    });
  }

  await increaseVersion({
    loan,
    session,
  });

  transaction.set(data);

  transaction.updatedBy = req.user._id;

  await transaction.save({ session });

  await createAuditLog({
    req,

    action: "LEGACY_TRANSACTION_UPDATED",

    targetType: "LegacyPawnTransaction",

    targetId: transaction._id,

    details: {
      pawnLoanId: loan._id,

      loanNumber: loan.loanNumber,

      changes,

      historyVersion:
        loan.legacyHistoryVersion,
    },

    session,
  });

  return buildResponse({
    loan,
    session,
  });
};

export const voidLegacyTransaction = async ({
  req,
  loanId,
  transactionId,
  input,
  session,
}) => {
  validateRequestFields(input, [
    "expectedVersion",
    "reason",
  ]);

  if (!isValidId(transactionId)) {
    throw new LegacyTransactionError(
      "Invalid historical transaction ID"
    );
  }

  const reason = validateTransactionText(
    input.reason,
    "void reason"
  );

  if (!reason) {
    throw new LegacyTransactionError(
      "Void reason is required"
    );
  }

  const loan = await getHistoryLoan({
    req,
    loanId,
    session,
    editable: true,
  });

  checkVersion(
    loan,
    input.expectedVersion
  );

  const transaction =
    await LegacyPawnTransaction.findOne({
      _id: transactionId,
      pawnLoan: loan._id,
    }).session(session);

  if (!transaction) {
    throw new LegacyTransactionError(
      "Historical transaction not found",
      404
    );
  }

  if (transaction.status !== "pending") {
    throw new LegacyTransactionError(
      "Only pending transactions can be voided",
      409
    );
  }

  const transactions =
    await loadTransactions({
      loan,
      session,
    });

  const proposedTransactions =
    transactions.map((item) =>
      String(item._id) ===
      String(transaction._id)
        ? {
            ...item,
            status: "voided",
          }
        : item
    );

  validateLegacyHistory({
    loan,
    transactions: proposedTransactions,
  });

  await increaseVersion({
    loan,
    session,
  });

  transaction.status = "voided";

  transaction.voidedAt = new Date();

  transaction.voidedBy = req.user._id;

  transaction.voidReason = reason;

  transaction.updatedBy = req.user._id;

  await transaction.save({ session });

  await createAuditLog({
    req,

    action: "LEGACY_TRANSACTION_VOIDED",

    targetType: "LegacyPawnTransaction",

    targetId: transaction._id,

    details: {
      pawnLoanId: loan._id,

      loanNumber: loan.loanNumber,

      transactionType:
        transaction.transactionType,

      amount: transaction.amount,

      reason,

      historyVersion:
        loan.legacyHistoryVersion,
    },

    session,
  });

  return buildResponse({
    loan,
    session,
  });
};

export const verifyLegacyTransactionHistory =
  async ({
    req,
    loanId,
    input,
    session,
  }) => {
    validateRequestFields(input, [
      "expectedVersion",
      "confirmCompleteHistory",
      "confirmNoDuplicateSettlements",
      "confirmNoHistoricalTransactions",
    ]);

    const loan = await getHistoryLoan({
      req,
      loanId,
      session,
      editable: true,
    });

    checkVersion(
      loan,
      input.expectedVersion
    );

    if (
      input.confirmCompleteHistory !== true ||
      input.confirmNoDuplicateSettlements !== true
    ) {
      throw new LegacyTransactionError(
        "Historical completeness and settlement reconciliation must be confirmed"
      );
    }

    const transactions =
      await loadTransactions({
        loan,
        session,
      });

    const summary =
      validateLegacyHistory({
        loan,
        transactions,
      });

    const activeTransactions =
      transactions.filter(
        (item) => item.status !== "voided"
      );

    if (
      activeTransactions.length === 0 &&
      input.confirmNoHistoricalTransactions !== true
    ) {
      throw new LegacyTransactionError(
        "Confirm that the original loan has no historical transactions"
      );
    }

    if (
      activeTransactions.length > 0 &&
      input.confirmNoHistoricalTransactions === true
    ) {
      throw new LegacyTransactionError(
        "Historical transactions already exist"
      );
    }

    if (
      activeTransactions.some(
        (item) => item.status !== "pending"
      )
    ) {
      throw new LegacyTransactionError(
        "Historical transaction status conflict",
        409
      );
    }

    const verifiedAt = new Date();

    const version =
      loan.legacyHistoryVersion ?? 0;

    validateHistoryVersion(version);

    loan.legacyHistoryVersion = version + 1;

    loan.legacyHistoryVerifiedAt =
      verifiedAt;

    loan.legacyHistoryVerifiedBy =
      req.user._id;

    loan.legacyMigrationStatus =
      "verified";

    await loan.save({ session });

    const result =
      await LegacyPawnTransaction.updateMany(
        {
          pawnLoan: loan._id,
          status: "pending",
        },
        {
          $set: {
            status: "verified",

            verifiedAt,

            verifiedBy: req.user._id,
          },
        },
        {
          session,
          runValidators: true,
        }
      );

    if (
      result.modifiedCount !==
      activeTransactions.length
    ) {
      throw new LegacyTransactionError(
        "Historical transaction verification conflict",
        409
      );
    }

    await createAuditLog({
      req,

      action:
        "LEGACY_TRANSACTION_HISTORY_VERIFIED",

      targetType: "PawnLoan",

      targetId: loan._id,

      details: {
        loanNumber: loan.loanNumber,

        historyVersion:
          loan.legacyHistoryVersion,

        verifiedTransactionCount:
          activeTransactions.length,

        confirmCompleteHistory: true,

        confirmNoDuplicateSettlements: true,

        confirmNoHistoricalTransactions:
          activeTransactions.length === 0,

        summary,
      },

      session,
    });

    return buildResponse({
      loan,
      session,
    });
  };