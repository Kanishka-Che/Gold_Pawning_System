
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateOutstandingPrincipal,
} from "../utils/outstandingBalance.js";

test("Loan without payments", () => {
  const result = calculateOutstandingPrincipal({
    originalPrincipal: "100000.00",
    payments: [],
  });

  assert.equal(
    result.outstandingPrincipal,
    "100000.00"
  );
});

test("Single principal payment", () => {
  const result = calculateOutstandingPrincipal({
    originalPrincipal: "100000.00",
    payments: [
      { principalPaid: "20000.00" },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "80000.00"
  );
});

test("Multiple principal payments", () => {
  const result = calculateOutstandingPrincipal({
    originalPrincipal: "100000.00",
    payments: [
      { principalPaid: "10000.00" },
      { principalPaid: "15000.00" },
      { principalPaid: "5000.00" },
    ],
  });

  assert.equal(
    result.totalPrincipalPaid,
    "30000.00"
  );

  assert.equal(
    result.outstandingPrincipal,
    "70000.00"
  );
});

test("Interest-only payment", () => {
  const result = calculateOutstandingPrincipal({
    originalPrincipal: "100000.00",
    payments: [
      { principalPaid: "0.00" },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "100000.00"
  );
});

test("Full principal settlement", () => {
  const result = calculateOutstandingPrincipal({
    originalPrincipal: "100000.00",
    payments: [
      { principalPaid: "100000.00" },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "0.00"
  );
});

test("Reject principal overpayment", () => {
  assert.throws(() =>
    calculateOutstandingPrincipal({
      originalPrincipal: "100000.00",
      payments: [
        { principalPaid: "110000.00" },
      ],
    })
  );
});

test("Reject invalid principal amount", () => {
  assert.throws(() =>
    calculateOutstandingPrincipal({
      originalPrincipal: "-1000.00",
      payments: [],
    })
  );
});

test("Exact decimal calculation", () => {
  const result = calculateOutstandingPrincipal({
    originalPrincipal: "0.30",
    payments: [
      { principalPaid: "0.10" },
      { principalPaid: "0.10" },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "0.10"
  );
});
