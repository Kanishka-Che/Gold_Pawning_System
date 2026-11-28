
import {
  getIndividualTransactionHistory,
  handleTransactionHistoryError,
} from "../services/individualTransactionHistoryService.js";

// GET /api/pawn-loans/:id/payments
export const getPawnLoanPaymentHistory = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    const history =
      await getIndividualTransactionHistory({
        req,
        transactionType: "payment",
      });

    const payments = history.transactions.map(
      (transaction) => ({
        _id: transaction.id,

        amount: transaction.amount,

        interestPaid: transaction.interestPaid,

        principalPaid: transaction.principalPaid,

        paymentMethod: transaction.paymentMethod,

        paidAt: transaction.transactionDate,

        recordedBy: transaction.recordedBy,

        reference: transaction.reference ?? "",

        transactionSource:
          transaction.transactionSource,

        isHistorical: transaction.isHistorical,

        ...(transaction.isHistorical
          ? {
              importedAt: transaction.importedAt,
              importedBy: transaction.importedBy,
              sequenceNumber:
                transaction.sequenceNumber,
            }
          : {}),
      })
    );

    return res.status(200).json({
      success: true,

      loanNumber: history.loan.loanNumber,

      page: history.pagination.page,

      limit: history.pagination.limit,

      total: history.pagination.total,

      totalPages: history.pagination.totalPages,

      summary: history.paymentSummary,

      payments,

      historySummary: history.historySummary,
    });
  } catch (error) {
    return handleTransactionHistoryError(
      res,
      error
    );
  }
};
