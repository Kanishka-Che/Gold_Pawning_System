
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateOverdueStatus,
} from "../utils/overdueCalculator.js";

const createLoan = ({
  status = "active",
  maturityDate = "2026-11-15T00:00:00Z",
  gracePeriodDays = 3,
} = {}) => ({
  status,
  maturityDate: new Date(maturityDate),
  settingsSnapshot: {
    overdue: {
      gracePeriodDays,
    },
  },
});

const calculate = (loan, date = "2026-11-21T00:00:00Z") =>
  calculateOverdueStatus({
    loan,
    calculationDate: new Date(date),
  });

test("Current loan before maturity", () => {
  const result = calculate(
    createLoan(),
    "2026-11-14T00:00:00Z"
  );

  assert.equal(result.overdueStatus, "current");
  assert.equal(result.daysOverdue, 0);
  assert.equal(result.daysAfterGrace, 0);
});

test("Loan on maturity date is current", () => {
  const result = calculate(
    createLoan(),
    "2026-11-15T00:00:00Z"
  );

  assert.equal(result.overdueStatus, "current");
  assert.equal(result.daysOverdue, 0);
});

test("First day after maturity is grace period", () => {
  const result = calculate(
    createLoan(),
    "2026-11-16T00:00:00Z"
  );

  assert.equal(result.overdueStatus, "grace_period");
  assert.equal(result.daysOverdue, 1);
});

test("Last day of grace period", () => {
  const result = calculate(
    createLoan(),
    "2026-11-18T00:00:00Z"
  );

  assert.equal(result.overdueStatus, "grace_period");
  assert.equal(result.daysOverdue, 3);
  assert.equal(result.daysAfterGrace, 0);
});

test("First day after grace period is overdue", () => {
  const result = calculate(
    createLoan(),
    "2026-11-19T00:00:00Z"
  );

  assert.equal(result.overdueStatus, "overdue");
  assert.equal(result.daysOverdue, 4);
  assert.equal(result.daysAfterGrace, 1);
});

test("Overdue days calculated correctly", () => {
  const result = calculate(createLoan());

  assert.deepEqual(result, {
  loanStatus: "active",
  overdueStatus: "overdue",
  classification: "overdue",
  daysOverdue: 6,
  daysUntilMaturity: 0,
  gracePeriodDays: 3,
  daysAfterGrace: 3,
  remainingGraceDays: 0,
  isDueToday: false,
  isUpcomingDue: false,
  isOverdue: true,
});
});

test("Zero grace period becomes overdue next day", () => {
  const result = calculate(
    createLoan({ gracePeriodDays: 0 }),
    "2026-11-16T00:00:00Z"
  );

  assert.equal(result.overdueStatus, "overdue");
  assert.equal(result.daysAfterGrace, 1);
});

test("Draft loan is not applicable", () => {
  const result = calculate(
    createLoan({ status: "draft" })
  );

  assert.equal(result.overdueStatus, "not_applicable");
  assert.equal(result.daysOverdue, 0);
});

test("Redeemed loan is not applicable", () => {
  const result = calculate(
    createLoan({ status: "redeemed" })
  );

  assert.equal(result.overdueStatus, "not_applicable");
});

test("Closed loan is not applicable", () => {
  const result = calculate(
    createLoan({ status: "closed" })
  );

  assert.equal(result.overdueStatus, "not_applicable");
});

test("Cancelled loan is not applicable", () => {
  const result = calculate(
    createLoan({ status: "cancelled" })
  );

  assert.equal(result.overdueStatus, "not_applicable");
});

test("Reject missing grace period settings", () => {
  const loan = createLoan();
  delete loan.settingsSnapshot.overdue.gracePeriodDays;

  assert.throws(
    () => calculate(loan),
    /grace period/i
  );
});

test("Reject negative grace period", () => {
  assert.throws(
    () =>
      calculate(
        createLoan({ gracePeriodDays: -1 })
      ),
    /grace period/i
  );
});

test("Reject decimal grace period", () => {
  assert.throws(
    () =>
      calculate(
        createLoan({ gracePeriodDays: 1.5 })
      ),
    /grace period/i
  );
});

test("Reject invalid maturity date", () => {
  assert.throws(
    () =>
      calculate(
        createLoan({
          maturityDate: "invalid-date",
        })
      ),
    /invalid date/i
  );
});

test("Reject missing loan", () => {
  assert.throws(
    () => calculate(null),
    /invalid pawn loan/i
  );
});

test("Sri Lanka calendar date boundary", () => {
  const loan = createLoan({
    maturityDate: "2026-11-15T18:29:00Z",
    gracePeriodDays: 0,
  });

  const beforeMidnight = calculate(
    loan,
    "2026-11-15T18:29:30Z"
  );

  const afterMidnight = calculate(
    loan,
    "2026-11-15T18:30:00Z"
  );

  assert.equal(beforeMidnight.overdueStatus, "current");
  assert.equal(afterMidnight.overdueStatus, "overdue");
});

test("Month boundary overdue calculation", () => {
  const result = calculate(
    createLoan({
      maturityDate: "2026-10-31T00:00:00Z",
      gracePeriodDays: 2,
    }),
    "2026-11-03T00:00:00Z"
  );

  assert.equal(result.daysOverdue, 3);
  assert.equal(result.daysAfterGrace, 1);
  assert.equal(result.overdueStatus, "overdue");
});
