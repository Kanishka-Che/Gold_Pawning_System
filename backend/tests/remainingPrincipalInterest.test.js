
import test from "node:test";
import assert from "node:assert/strict";

import { buildPrincipalHistory } from "../utils/principalHistory.js";


import {
  calculateRemainingPrincipalDailyInterest,
} from "../utils/remainingPrincipalInterest.js";

test("Daily remaining principal interest", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-21T00:00:00+05:30",
    monthlyRate: 5,
    payments: [
      {
        paidAt: "2026-11-11T00:00:00+05:30",
        principalPaid: "20000.00",
      },
    ],
  });

  assert.equal(result.totalDays, 20);
  assert.equal(result.outstandingPrincipal, "80000.00");
  assert.equal(result.accruedInterest, "3000.00");
  assert.equal(result.periods.length, 2);
});


test("No payments keeps original principal", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-11T00:00:00+05:30",
    monthlyRate: 3,
    payments: [],
  });

  assert.equal(result.outstandingPrincipal, "100000.00");
  assert.equal(result.accruedInterest, "1000.00");
});

test("Multiple principal payments", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-12-01T00:00:00+05:30",
    monthlyRate: 3,
    payments: [
      {
        paidAt: "2026-11-11T00:00:00+05:30",
        principalPaid: "20000.00",
      },
      {
        paidAt: "2026-11-21T00:00:00+05:30",
        principalPaid: "30000.00",
      },
    ],
  });

  assert.equal(result.outstandingPrincipal, "50000.00");
  assert.equal(result.accruedInterest, "2300.00");
});

test("Reject principal overpayment", () => {
  assert.throws(() =>
    calculateRemainingPrincipalDailyInterest({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-01T00:00:00+05:30",
      calculationDate: "2026-11-21T00:00:00+05:30",
      monthlyRate: 3,
      payments: [
        {
          paidAt: "2026-11-11T00:00:00+05:30",
          principalPaid: "120000.00",
        },
      ],
    })
  );
});


test("Same-day principal payment", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-11T00:00:00+05:30",
    monthlyRate: 3,
    payments: [
      {
        paidAt: "2026-11-01T12:00:00+05:30",
        principalPaid: "20000.00",
      },
    ],
  });

  assert.equal(result.outstandingPrincipal, "80000.00");
  assert.equal(result.accruedInterest, "800.00");
});

test("Sri Lanka midnight date boundary", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-03T00:00:00+05:30",
    monthlyRate: 3,
    payments: [
      {
        paidAt: "2026-11-02T00:00:00+05:30",
        principalPaid: "50000.00",
      },
    ],
  });

  assert.equal(result.totalDays, 2);
  assert.equal(result.accruedInterest, "150.00");
});


test("Multiple payments on the same day", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-11T00:00:00+05:30",
    monthlyRate: 3,
    payments: [
      {
        paidAt: "2026-11-01T10:00:00+05:30",
        principalPaid: "10000.00",
      },
      {
        paidAt: "2026-11-01T15:00:00+05:30",
        principalPaid: "20000.00",
      },
    ],
  });

  assert.equal(result.outstandingPrincipal, "70000.00");
  assert.equal(result.accruedInterest, "700.00");
});

test("Full principal settlement stops future interest", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-11-21T00:00:00+05:30",
    monthlyRate: 3,
    payments: [
      {
        paidAt: "2026-11-11T00:00:00+05:30",
        principalPaid: "100000.00",
      },
    ],
  });

  assert.equal(result.outstandingPrincipal, "0.00");
  assert.equal(result.accruedInterest, "1000.00");
});

test("Reject negative monthly interest rate", () => {
  assert.throws(() =>
    calculateRemainingPrincipalDailyInterest({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-01T00:00:00+05:30",
      calculationDate: "2026-11-11T00:00:00+05:30",
      monthlyRate: -3,
      payments: [],
    })
  );
});



test("Accept four-decimal monthly interest rate", () => {
  const result = calculateRemainingPrincipalDailyInterest({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-12-01T00:00:00+05:30",
    monthlyRate: 2.1234,
    payments: [],
  });

  assert.equal(result.accruedInterest, "2123.40");
});

test("Reject monthly rate exceeding four decimals", () => {
  assert.throws(() =>
    calculateRemainingPrincipalDailyInterest({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-01T00:00:00+05:30",
      calculationDate: "2026-12-01T00:00:00+05:30",
      monthlyRate: 2.12345,
      payments: [],
    })
  );
});


test("Reject invalid calendar date", () => {
  assert.throws(() =>
    buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-31T00:00:00+05:30",
      calculationDate: "2026-12-01T00:00:00+05:30",
      payments: [],
    })
  );
});

test("Accept valid leap year date", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "100000.00",
    issueDate: "2028-02-29T00:00:00+05:30",
    calculationDate: "2028-03-01T00:00:00+05:30",
    payments: [],
  });

  assert.equal(
    result.outstandingPrincipal,
    "100000.00"
  );
});

test("Reject invalid payment date", () => {
  assert.throws(() =>
    buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-01T00:00:00+05:30",
      calculationDate: "2026-12-01T00:00:00+05:30",
      payments: [
        {
          paidAt: "2026-11-31T00:00:00+05:30",
          principalPaid: "10000.00",
        },
      ],
    })
  );
});


test("Reject invalid calendar date with specific error", () => {
  assert.throws(
    () => buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-31T00:00:00+05:30",
      calculationDate: "2026-12-01T00:00:00+05:30",
      payments: [],
    }),
    /Invalid issue date/
  );
});

test("Reject invalid timezone offset", () => {
  assert.throws(
    () => buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate: "2026-11-01T00:00:00+25:30",
      calculationDate: "2026-11-11T00:00:00+05:30",
      payments: [],
    }),
    /Invalid issue date/
  );
});

test("Different timezone offsets representing same instant", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "100000.00",
    issueDate: "2026-11-01T00:00:00+05:30",
    calculationDate: "2026-10-31T18:30:00Z",
    payments: [],
  });

  assert.equal(result.periods.length, 0);
  assert.equal(result.outstandingPrincipal, "100000.00");
});

