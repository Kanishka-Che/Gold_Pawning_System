
import PawnPayment from "../models/PawnPayment.js";

export async function loadPrincipalPaymentHistory({
  pawnLoanId,
  calculationDate,
}) {
  const payments = await PawnPayment.find({
    pawnLoan: pawnLoanId,
    paidAt: {
      $lte: calculationDate,
    },
  })
    .select("paidAt principalPaid")
    .sort({ paidAt: 1, _id: 1 })
    .lean();

  return payments.map((payment) => ({
    paidAt: payment.paidAt.toISOString(),
    principalPaid: payment.principalPaid,
  }));
}
