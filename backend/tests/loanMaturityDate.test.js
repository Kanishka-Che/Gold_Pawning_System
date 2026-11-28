import test from "node:test";
import assert from "node:assert/strict";

import {
  addRenewalMonths,
} from "../utils/renewalDateCalculator.js";

test("Calculate normal loan maturity date", () => {
  const result = addRenewalMonths({
    baseDate: "2027-01-15T10:00:00+05:30",
    durationMonths: 6,
  });

  assert.equal(
    result.toISOString(),
    "2027-07-15T04:30:00.000Z"
  );
});

test("Handle January month-end correctly", () => {
  const result = addRenewalMonths({
    baseDate: "2027-01-31T10:00:00+05:30",
    durationMonths: 1,
  });

  assert.equal(
    result.toISOString(),
    "2027-02-28T04:30:00.000Z"
  );
});

test("Handle leap year correctly", () => {
  const result = addRenewalMonths({
    baseDate: "2028-01-31T10:00:00+05:30",
    durationMonths: 1,
  });

  assert.equal(
    result.toISOString(),
    "2028-02-29T04:30:00.000Z"
  );
});

test("Handle March month-end correctly", () => {
  const result = addRenewalMonths({
    baseDate: "2027-03-31T10:00:00+05:30",
    durationMonths: 1,
  });

  assert.equal(
    result.toISOString(),
    "2027-04-30T04:30:00.000Z"
  );
});

test("Handle year transition correctly", () => {
  const result = addRenewalMonths({
    baseDate: "2027-12-31T10:00:00+05:30",
    durationMonths: 1,
  });

  assert.equal(
    result.toISOString(),
    "2028-01-31T04:30:00.000Z"
  );
});

test("Use Sri Lanka calendar near midnight", () => {
  const result = addRenewalMonths({
    baseDate: "2027-01-31T00:15:00+05:30",
    durationMonths: 1,
  });

  assert.equal(
    result.toISOString(),
    "2027-02-27T18:45:00.000Z"
  );
});

test("Reject zero loan duration", () => {
  assert.throws(() =>
    addRenewalMonths({
      baseDate: "2027-01-01",
      durationMonths: 0,
    })
  );
});

test("Reject negative loan duration", () => {
  assert.throws(() =>
    addRenewalMonths({
      baseDate: "2027-01-01",
      durationMonths: -1,
    })
  );
});

test("Reject fractional loan duration", () => {
  assert.throws(() =>
    addRenewalMonths({
      baseDate: "2027-01-01",
      durationMonths: 1.5,
    })
  );
});

test("Reject duration exceeding maximum", () => {
  assert.throws(() =>
    addRenewalMonths({
      baseDate: "2027-01-01",
      durationMonths: 121,
    })
  );
});

test("Reject invalid issue date", () => {
  assert.throws(() =>
    addRenewalMonths({
      baseDate: "invalid-date",
      durationMonths: 6,
    })
  );
});