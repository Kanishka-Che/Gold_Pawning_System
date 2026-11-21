
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPrincipalHistory,
} from "../utils/principalHistory.js";

const issueDate = "2026-11-01T00:00:00+05:30";
const calculationDate = "2026-11-21T00:00:00+05:30";

test("History without payments", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "100000.00",
    issueDate,
    calculationDate,
    payments: [],
  });

  assert.equal(result.periods.length, 1);
  assert.equal(
    result.periods[0].principal,
    "100000.00"
  );
  assert.equal(
    result.outstandingPrincipal,
    "100000.00"
  );
});

test("History with one principal payment", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "100000.00",
    issueDate,
    calculationDate,
    payments: [
      {
        principalPaid: "20000.00",
        paidAt: "2026-11-11T00:00:00+05:30",
      },
    ],
  });

  assert.equal(result.periods.length, 2);
  assert.equal(
    result.periods[0].principal,
    "100000.00"
  );
  assert.equal(
    result.periods[1].principal,
    "80000.00"
  );
});

test("Multiple principal payments", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "100000.00",
    issueDate,
    calculationDate,
    payments: [
      {
        principalPaid: "10000.00",
        paidAt: "2026-11-16T00:00:00+05:30",
      },
      {
        principalPaid: "20000.00",
        paidAt: "2026-11-11T00:00:00+05:30",
      },
    ],
  });

  assert.deepEqual(
    result.periods.map((p) => p.principal),
    ["100000.00", "80000.00", "70000.00"]
  );

  assert.equal(
    result.outstandingPrincipal,
    "70000.00"
  );
});

test("Interest-only payment does not reduce principal", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "100000.00",
    issueDate,
    calculationDate,
    payments: [
      {
        principalPaid: "0.00",
        paidAt: "2026-11-11T00:00:00+05:30",
      },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "100000.00"
  );
});

test("Reject principal overpayment", () => {
  assert.throws(() =>
    buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate,
      calculationDate,
      payments: [
        {
          principalPaid: "110000.00",
          paidAt: "2026-11-11T00:00:00+05:30",
        },
      ],
    })
  );
});

test("Reject payment before loan issue", () => {
  assert.throws(() =>
    buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate,
      calculationDate,
      payments: [
        {
          principalPaid: "1000.00",
          paidAt: "2026-10-31T00:00:00+05:30",
        },
      ],
    })
  );
});

test("Reject future payment relative to calculation", () => {
  assert.throws(() =>
    buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate,
      calculationDate,
      payments: [
        {
          principalPaid: "1000.00",
          paidAt: "2026-11-22T00:00:00+05:30",
        },
      ],
    })
  );
});

test("Exact decimal principal tracking", () => {
  const result = buildPrincipalHistory({
    originalPrincipal: "0.30",
    issueDate,
    calculationDate,
    payments: [
      {
        principalPaid: "0.10",
        paidAt: "2026-11-11T00:00:00+05:30",
      },
    ],
  });

  assert.equal(
    result.outstandingPrincipal,
    "0.20"
  );
});

test("Reject invalid calculation date", () => {
  assert.throws(() =>
    buildPrincipalHistory({
      originalPrincipal: "100000.00",
      issueDate,
      calculationDate: "invalid-date",
      payments: [],
    })
  );
});
