
const TYPE_ORDER = {
  payment: 0,
  renewal: 1,
  redemption: 2,
};

export const normalizeLegacyTransaction = (
  transaction
) => {
  if (transaction.status !== "verified") {
    throw new Error(
      "Only verified historical transactions are supported"
    );
  }

  const common = {
    id: transaction._id,

    type: transaction.transactionType,

    transactionDate:
      transaction.transactionDate,

    amount: transaction.amount,

    transactionSource: "historical",

    isHistorical: true,

    sequenceNumber:
      transaction.sequenceNumber,

    reference:
      transaction.historicalReference ?? "",

    importedAt: transaction.importedAt,

    importedBy: transaction.importedBy,

    recordedBy: null,
  };

  if (transaction.transactionType === "payment") {
    return {
      ...common,

      principalPaid:
        transaction.principalPaid,

      interestPaid:
        transaction.interestPaid,

      paymentMethod:
        transaction.paymentMethod,
    };
  }

  if (transaction.transactionType === "renewal") {
    return {
      ...common,

      interestSettled:
        transaction.interestPaid,

      renewalFeePaid:
        transaction.renewalFeePaid,

      previousMaturityDate:
        transaction.previousMaturityDate,

      newMaturityDate:
        transaction.newMaturityDate,

        settingsVersion: null,

        notes: transaction.notes ?? "",

      
    };
  }

  throw new Error(
    "Unsupported historical transaction type"
  );
};


export const normalizeLivePayment = (payment) => ({
  id: payment._id,

  type: "payment",

  transactionDate: payment.paidAt,

  amount: payment.amount,

  interestPaid: payment.interestPaid,

  principalPaid: payment.principalPaid,

  paymentMethod: payment.paymentMethod,

  reference: payment.reference,

  recordedBy: payment.recordedBy,

  transactionSource: "live",

  isHistorical: false,
});



export const normalizeLiveRenewal = (renewal) => ({
  id: renewal._id,

  type: "renewal",

  transactionDate: renewal.renewedAt,

  amount:
    Math.round(
      (
        renewal.interestSettled +
        renewal.renewalFeePaid
      ) * 100
    ) / 100,

  interestSettled: renewal.interestSettled,

  renewalFeePaid: renewal.renewalFeePaid,

  previousMaturityDate:
    renewal.previousMaturityDate,

  newMaturityDate:
    renewal.newMaturityDate,

  settingsVersion: renewal.settingsVersion,

  notes: renewal.notes ?? "",

  recordedBy: renewal.renewedBy,

  transactionSource: "live",

  isHistorical: false,
});



export const normalizeLiveRedemption = (
  redemption
) => ({
  id: redemption._id,

  type: "redemption",

  transactionDate: redemption.redeemedAt,

  amount: redemption.totalSettled,

  principalSettled:
    redemption.principalSettled,

  interestSettled:
    redemption.interestSettled,

  penaltySettled:
    redemption.penaltySettled,

  settingsVersion:
    redemption.settingsVersion,

  recordedBy: redemption.redeemedBy,

  transactionSource: "live",

  isHistorical: false,
});


export const sortCombinedTransactions = (
  transactions
) => {
  if (!Array.isArray(transactions)) {
    throw new Error(
      "Transactions must be an array"
    );
  }

  for (const transaction of transactions) {
    if (
      !transaction.transactionDate ||
      !Number.isFinite(
        new Date(
          transaction.transactionDate
        ).getTime()
      )
    ) {
      throw new Error(
        "Invalid transaction date"
      );
    }
  }

  return [...transactions].sort((a, b) => {
    // Latest transaction first
    const dateDifference =
      new Date(b.transactionDate).getTime() -
      new Date(a.transactionDate).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    // Live transactions first when timestamps match
    if (a.isHistorical !== b.isHistorical) {
      return a.isHistorical ? 1 : -1;
    }

    // Preserve original historical sequence
    if (a.isHistorical && b.isHistorical) {
      const sequenceDifference =
        b.sequenceNumber - a.sequenceNumber;

      if (sequenceDifference !== 0) {
        return sequenceDifference;
      }
    }

    const typeDifference =
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type];

    if (typeDifference !== 0) {
      return typeDifference;
    }

    return String(b.id).localeCompare(
      String(a.id)
    );
  });
};
