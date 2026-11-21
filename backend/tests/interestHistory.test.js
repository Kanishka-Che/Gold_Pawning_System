
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInterestHistory,
} from "../utils/interestHistory.js";

const base = {
  originalPrincipal: "100000.00",
  issueDate: "2026-11-01T00:00:00+05:30",
  calculationDate: "2026-11-21T00:00:00+05:30",
  payments: [
    {
      principalPaid: "20000.00",
      paidAt: "2026-11-11T00:00:00+05:30",
    },
  ],
};

test("Original principal method", () => {
  const result = buildInterestHistory({
    ...base,
    principalCalculationMethod: "original_principal",
  });

  assert.deepEqual(
    result.periods.map((p) => p.interestPrincipal),
    ["100000.00", "100000.00"]
  );
});

test("Remaining principal method", () => {
  const result = buildInterestHistory({
    ...base,
    principalCalculationMethod: "remaining_principal",
  });

  assert.deepEqual(
    result.periods.map((p) => p.interestPrincipal),
    ["100000.00", "80000.00"]
  );
});

test("Reject unconfirmed rule", () => {
  assert.throws(
    () => buildInterestHistory(base),
    /Invalid or unconfirmed/
  );
});

test("Reject unsupported rule", () => {
  assert.throws(
    () =>
      buildInterestHistory({
        ...base,
        principalCalculationMethod: "unknown",
      }),
    /Invalid or unconfirmed/
  );
});

test("Reject principal overpayment", () => {
  assert.throws(() =>
    buildInterestHistory({
      ...base,
      payments: [
        {
          principalPaid: "120000.00",
          paidAt: "2026-11-11T00:00:00+05:30",
        },
      ],
      principalCalculationMethod:
        "remaining_principal",
    })
  );
});

test("No payments retains original principal", () => {
  const result = buildInterestHistory({
    ...base,
    payments: [],
    principalCalculationMethod:
      "remaining_principal",
  });

  assert.equal(result.periods.length, 1);
  assert.equal(
    result.periods[0].interestPrincipal,
    "100000.00"
  );
});

test("Interest-only payment retains principal", () => {
  const result = buildInterestHistory({
    ...base,
    payments: [
      {
        principalPaid: "0.00",
        paidAt: "2026-11-11T00:00:00+05:30",
      },
    ],
    principalCalculationMethod:
      "remaining_principal",
  });

  assert.equal(
    result.outstandingPrincipal,
    "100000.00"
  );

  assert.ok(
    result.periods.every(
      (p) => p.interestPrincipal === "100000.00"
    )
  );
});
