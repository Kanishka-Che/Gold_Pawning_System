
export const formatPaymentReplayResponse = (result) => {
  if (
    !result ||
    typeof result !== "object" ||
    !["new", "replay", "conflict"].includes(result.status)
  ) {
    throw new Error("Invalid payment replay result");
  }

  if (result.status === "new") {
    return {
      statusCode: 501,
      body: {
        success: false,
        message: "Payment recording is not implemented yet",
      },
    };
  }

  if (result.status === "conflict") {
    return {
      statusCode: 409,
      body: {
        success: false,
        message:
          "Idempotency key was already used for a different payment request",
      },
    };
  }

  const payment = result.payment;

  if (
    !payment?._id ||
    !payment?.pawnLoan ||
    !payment?.idempotencyKey
  ) {
    throw new Error("Invalid existing payment record");
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      replayed: true,
      message: "Payment already recorded",
      payment: {
        id: String(payment._id),
        pawnLoanId: String(payment.pawnLoan),
        amount: payment.amount,
        interestPaid: payment.interestPaid,
        principalPaid: payment.principalPaid,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        reference: payment.reference ?? "",
      },
    },
  };
};
