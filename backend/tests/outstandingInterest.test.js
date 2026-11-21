
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateOutstandingInterest,
} from "../utils/outstandingInterest.js";

test("No interest payments", () => {
  const result = calculateOutstandingInterest({
    accruedInterest: "5000.00",
    payments: [],
  });

  assert.equal(
    result.outstandingInterest,
    "5000.00"
  );
});

test("Single interest payment", () => {
  const result = calculateOutstandingInterest({
    accruedInterest: "5000.00",
    payments: [
      { interestPaid: "2000.00" },
    ],
  });

  assert.equal(
    result.outstandingInterest,
    "3000.00"
  );
});

test("Multiple interest payments", () => {
  const result = calculateOutstandingInterest({
    accruedInterest: "5000.00",
    payments: [
      { interestPaid: "1000.00" },
      { interestPaid: "1500.00" },
    ],
  });

  assert.equal(
    result.totalInterestPaid,
    "2500.00"
  );

  assert.equal(
    result.outstandingInterest,
    "2500.00"
  );
});

test("Full interest settlement", () => {
  const result = calculateOutstandingInterest({
    accruedInterest: "5000.00",
    payments: [
      { interestPaid: "5000.00" },
    ],
  });

  assert.equal(
    result.outstandingInterest,
    "0.00"
  );
});

test("Reject interest overpayment", () => {
  assert.throws(() =>
    calculateOutstandingInterest({
      accruedInterest: "5000.00",
      payments: [
        { interestPaid: "6000.00" },
      ],
    })
  );
});

test("Reject negative accrued interest", () => {
  assert.throws(() =>
    calculateOutstandingInterest({
      accruedInterest: "-100.00",
      payments: [],
    })
  );
});

test("Exact decimal interest calculation", () => {
  const result = calculateOutstandingInterest({
    accruedInterest: "0.30",
    payments: [
      { interestPaid: "0.10" },
      { interestPaid: "0.10" },
    ],
  });

  assert.equal(
    result.outstandingInterest,
    "0.10"
  );
});

test("Principal-only payment does not reduce interest", () => {
  const result = calculateOutstandingInterest({
    accruedInterest: "5000.00",
    payments: [
      { interestPaid: "0.00" },
    ],
  });

  assert.equal(
    result.outstandingInterest,
    "5000.00"
  );
});
