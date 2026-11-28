import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePawnInterest,
} from "../services/interestCalculator.js";

const validSettings = {
  rate: 3,
  calculationMethod: "monthly",
  principalCalculationMethod: "original_principal",
  minimumInterestDays: 0,
  chargeFullFirstMonth: false,
};

const baseLoan = {
  principalAmount: 10000,
  issueDate: "2026-01-01T10:00:00+05:30",
  calculationDate: "2026-01-31T10:00:00+05:30",
  interestSettings: validSettings,
  payments: [],
};

// Test 01
test("Calculate monthly original principal interest", () => {
  const result = calculatePawnInterest(baseLoan);

  assert.equal(result.elapsedDays, 30);
  assert.equal(result.chargedMonths, 1);
  assert.equal(result.accruedInterest, "300.00");
  assert.equal(result.outstandingInterest, "300.00");
});

// Test 02
test("Calculate daily original principal interest", () => {
  const result = calculatePawnInterest({
    ...baseLoan,
    interestSettings: {
      ...validSettings,
      calculationMethod: "daily",
    },
  });

  assert.equal(result.elapsedDays, 30);
  assert.equal(result.chargedMonths, null);
  assert.equal(result.accruedInterest, "300.00");
});

// Test 03
test("Calculate daily remaining principal interest", () => {
  const result = calculatePawnInterest({
    ...baseLoan,
    interestSettings: {
      ...validSettings,
      calculationMethod: "daily",
      principalCalculationMethod: "remaining_principal",
    },
    payments: [
      {
        paidAt: "2026-01-16T10:00:00+05:30",
        principalPaid: 4000,
        interestPaid: 0,
      },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "6000.00"
  );

  assert.equal(
    result.accruedInterest,
    "240.00"
  );

  assert.equal(
    result.outstandingInterest,
    "240.00"
  );
});

// Test 04
test("Deduct previously paid interest", () => {
  const result = calculatePawnInterest({
    ...baseLoan,
    payments: [
      {
        paidAt: "2026-01-16T10:00:00+05:30",
        principalPaid: 0,
        interestPaid: 100,
      },
    ],
  });

  assert.equal(result.accruedInterest, "300.00");
  assert.equal(result.totalInterestPaid, "100.00");
  assert.equal(result.outstandingInterest, "200.00");
});

// Test 05
test("Original principal remains unchanged after principal payment", () => {
  const result = calculatePawnInterest({
    ...baseLoan,
    payments: [
      {
        paidAt: "2026-01-16T10:00:00+05:30",
        principalPaid: 4000,
        interestPaid: 0,
      },
    ],
  });

  assert.equal(result.accruedInterest, "300.00");
});

// Test 06
test("Calculate zero interest on issue date", () => {
  const result = calculatePawnInterest({
    ...baseLoan,
    calculationDate: baseLoan.issueDate,
  });

  assert.equal(result.elapsedDays, 0);
  assert.equal(result.accruedInterest, "0.00");
});

// Test 07
test("Reject unsupported monthly remaining principal", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        interestSettings: {
          ...validSettings,
          principalCalculationMethod:
            "remaining_principal",
        },
      }),
    { statusCode: 409 }
  );
});

// Test 08
test("Reject unsupported minimum interest days", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        interestSettings: {
          ...validSettings,
          minimumInterestDays: 7,
        },
      }),
    { statusCode: 409 }
  );
});

// Test 09
test("Reject calculation date before issue date", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        calculationDate:
          "2025-12-31T10:00:00+05:30",
      }),
    /Calculation date cannot be before issue date/
  );
});

// Test 10
test("Reject interest payments exceeding accrued interest", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        payments: [
          {
            paidAt:
              "2026-01-31T10:00:00+05:30",
            principalPaid: 0,
            interestPaid: 500,
          },
        ],
      }),
    /Total interest paid exceeds accrued interest/
  );
});

// Test 11
test("Reject invalid payment history", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        payments: null,
      }),
    /Payments must be an array/
  );
});

// Test 12
test("Preserve preview response safety flags", () => {
  const result = calculatePawnInterest(baseLoan);

  assert.equal(result.currency, "LKR");

  assert.equal(
    result.calculationMethod,
    "monthly"
  );

  assert.equal(
    result.principalCalculationMethod,
    "original_principal"
  );

  assert.equal(
    result.isFinalSettlementAmount,
    false
  );
});

// Test 13
test("Reject unsupported interest rate", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        interestSettings: {
          ...validSettings,
          rate: 101,
        },
      }),
    { statusCode: 409 }
  );
});

// Test 14
test("Reject missing interest settings", () => {
  assert.throws(
    () =>
      calculatePawnInterest({
        ...baseLoan,
        interestSettings: null,
      }),
    { statusCode: 409 }
  );
});