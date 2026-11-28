
import { isValidMoney } from "./moneyValidator.js";

const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

const toCents = (value) => {
  if (!isValidMoney(value, { allowZero: true })) {
    throw new Error("Invalid payment history amount");
  }

  const [whole, fraction = ""] =
    String(value).split(".");

  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"))
  );
};

const fromCents = (cents) => {
  if (cents < 0n || cents > MAX_CENTS) {
    throw new Error(
      "Payment history total exceeds safe range"
    );
  }

  const value = Number(cents) / 100;

  if (toCents(value) !== cents) {
    throw new Error(
      "Payment history total cannot be represented safely"
    );
  }

  return value;
};

export const createPaymentHistoryAccumulator = () => {
  let totalAmount = 0n;
  let totalPrincipalPaid = 0n;
  let totalInterestPaid = 0n;

  return {
    add(payment) {
      const amount = toCents(payment.amount);

      const principal = toCents(
        payment.principalPaid
      );

      const interest = toCents(
        payment.interestPaid
      );

      if (
        amount <= 0n ||
        amount !== principal + interest
      ) {
        throw new Error(
          "Invalid payment history allocation"
        );
      }

      totalAmount += amount;
      totalPrincipalPaid += principal;
      totalInterestPaid += interest;

      if (totalAmount > MAX_CENTS) {
        throw new Error(
          "Payment history total exceeds safe range"
        );
      }
    },

    getSummary() {
      return {
        totalAmount: fromCents(totalAmount),

        totalPrincipalPaid:
          fromCents(totalPrincipalPaid),

        totalInterestPaid:
          fromCents(totalInterestPaid),
      };
    },
  };
};
