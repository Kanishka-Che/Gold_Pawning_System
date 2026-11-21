
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateLoanBalanceSummary,
} from "../utils/loanBalanceSummary.js";

test("Loan without payments", () => {
  const result = calculateLoanBalanceSummary({
    originalPrincipal: "100000.00",
    accruedInterest: "5000.00",
    payments: [],
  });

  assert.equal(result.combinedBalance, "105000.00");
  assert.equal(result.isFinalSettlementAmount, false);
});

test("Combined principal and interest repayments", () => {
  const result = calculateLoanBalanceSummary({
    originalPrincipal: "100000.00",
    accruedInterest: "5000.00",
    payments: [
      {
        principalPaid: "20000.00",
        interestPaid: "2000.00",
      },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "80000.00"
  );

  assert.equal(
    result.outstandingInterest,
    "3000.00"
  );

  assert.equal(result.combinedBalance, "83000.00");
});

test("Multiple repayments", () => {
  const result = calculateLoanBalanceSummary({
    originalPrincipal: "100000.00",
    accruedInterest: "5000.00",
    payments: [
      {
        principalPaid: "10000.00",
        interestPaid: "1000.00",
      },
      {
        principalPaid: "5000.00",
        interestPaid: "1500.00",
      },
    ],
  });

  assert.equal(result.combinedBalance, "87500.00");
});

test("Full principal and interest settlement", () => {
  const result = calculateLoanBalanceSummary({
    originalPrincipal: "100000.00",
    accruedInterest: "5000.00",
    payments: [
      {
        principalPaid: "100000.00",
        interestPaid: "5000.00",
      },
    ],
  });

  assert.equal(result.combinedBalance, "0.00");
});

test("Reject principal overpayment", () => {
  assert.throws(() =>
    calculateLoanBalanceSummary({
      originalPrincipal: "100000.00",
      accruedInterest: "5000.00",
      payments: [
        {
          principalPaid: "110000.00",
          interestPaid: "0.00",
        },
      ],
    })
  );
});

test("Reject interest overpayment", () => {
  assert.throws(() =>
    calculateLoanBalanceSummary({
      originalPrincipal: "100000.00",
      accruedInterest: "5000.00",
      payments: [
        {
          principalPaid: "0.00",
          interestPaid: "6000.00",
        },
      ],
    })
  );
});

test("Exact decimal combined balance", () => {
  const result = calculateLoanBalanceSummary({
    originalPrincipal: "0.30",
    accruedInterest: "0.20",
    payments: [
      {
        principalPaid: "0.10",
        interestPaid: "0.10",
      },
    ],
  });

  assert.equal(result.combinedBalance, "0.30");
});

test("Reject invalid payments", () => {
  assert.throws(() =>
    calculateLoanBalanceSummary({
      originalPrincipal: "100000.00",
      accruedInterest: "5000.00",
      payments: null,
    })
  );
});
