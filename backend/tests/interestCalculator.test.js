
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateMonthlyInterest,
  calculateDailyInterest,
  calculateLoanInterest,
  calculateInterestPeriod,
} from "../utils/interestCalculator.js";

test("Monthly interest calculation", () => {
  const result = calculateMonthlyInterest({
    principalAmount: 100000,
    monthlyRate: 2,
    months: 3,
  });

  assert.equal(result.interestAmount, 6000);
  assert.equal(result.totalAmount, 106000);
});

test("Daily interest calculation", () => {
  const result = calculateDailyInterest({
    principalAmount: 100000,
    monthlyRate: 2,
    days: 15,
  });

  assert.equal(result.interestAmount, 1000);
  assert.equal(result.totalAmount, 101000);
});

test("Loan settings compatibility", () => {
  const result = calculateLoanInterest({
    principalAmount: 100000,
    interestSettings: {
      rate: 2,
      calculationMethod: "monthly",
      principalCalculationMethod: "original_principal",
      minimumInterestDays: 0,
      chargeFullFirstMonth: false,
    },
    months: 3,
    days: 90,
  });

  assert.equal(result.interestAmount, 6000);
  assert.equal(result.calculationMethod, "monthly");
});

test("Reject invalid monetary amounts", () => {
  assert.throws(() =>
    calculateMonthlyInterest({
      principalAmount: 1000.555,
      monthlyRate: 2,
      months: 1,
    })
  );

  assert.throws(() =>
    calculateMonthlyInterest({
      principalAmount: -1000,
      monthlyRate: 2,
      months: 1,
    })
  );
});

test("Reject negative interest rates", () => {
  assert.throws(() =>
    calculateMonthlyInterest({
      principalAmount: 100000,
      monthlyRate: -2,
      months: 1,
    })
  );
});

test("Sri Lanka calendar date calculation", () => {
  const result = calculateInterestPeriod({
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-16T00:00:00+05:30",
  });

  assert.equal(result.days, 15);
  assert.equal(result.months, 1);
});

test("Reject calculation date before issue date", () => {
  assert.throws(() =>
    calculateInterestPeriod({
      issueDate: "2026-11-20T00:00:00+05:30",
      calculationDate: "2026-11-19T00:00:00+05:30",
    })
  );
});


test("Reject unsupported interest calculation rules", () => {
 const baseSettings = {
  rate: 2,
  calculationMethod: "daily",
  principalCalculationMethod: "original_principal",
  minimumInterestDays: 0,
  chargeFullFirstMonth: false,
};

  // Supported configuration should calculate normally.
  const result = calculateLoanInterest({
    principalAmount: 100000,
    interestSettings: baseSettings,
    months: 1,
    days: 5,
  });

  assert.equal(result.interestAmount, 333.33);

  // Minimum interest days is not implemented yet.
  assert.throws(
    () =>
      calculateLoanInterest({
        principalAmount: 100000,
        interestSettings: {
          ...baseSettings,
          minimumInterestDays: 10,
        },
        months: 1,
        days: 5,
      }),
    /not yet supported/
  );

  // Full first month charging is not implemented yet.
  assert.throws(
    () =>
      calculateLoanInterest({
        principalAmount: 100000,
        interestSettings: {
          ...baseSettings,
          chargeFullFirstMonth: true,
        },
        months: 1,
        days: 5,
      }),
    /not yet supported/
  );

  console.log("Unsupported interest rules safely blocked: PASSED");
});


test("Reject unconfirmed principal calculation methods", () => {
  const baseSettings = {
    rate: 2,
    calculationMethod: "monthly",
    principalCalculationMethod: "original_principal",
    minimumInterestDays: 0,
    chargeFullFirstMonth: false,
  };

  // Existing original principal calculation is supported.
  const result = calculateLoanInterest({
    principalAmount: 100000,
    interestSettings: baseSettings,
    months: 1,
    days: 30,
  });

  assert.equal(result.interestAmount, 2000);

  // Remaining principal integration is not implemented yet.
  assert.throws(
    () =>
      calculateLoanInterest({
        principalAmount: 100000,
        interestSettings: {
          ...baseSettings,
          principalCalculationMethod: "remaining_principal",
        },
        months: 1,
        days: 30,
      }),
    /not yet supported/
  );

  // Unconfirmed principal method must not be assumed.
  assert.throws(
    () =>
      calculateLoanInterest({
        principalAmount: 100000,
        interestSettings: {
          ...baseSettings,
          principalCalculationMethod: undefined,
        },
        months: 1,
        days: 30,
      }),
    /not yet supported/
  );
});
