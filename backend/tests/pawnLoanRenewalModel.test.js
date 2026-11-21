
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import PawnLoanRenewal from "../models/PawnLoanRenewal.js";

const createValidRenewal = (overrides = {}) => {
  return new PawnLoanRenewal({
    pawnLoan: new mongoose.Types.ObjectId(),
    idempotencyKey: "renewal_test_key_123456",
    previousMaturityDate: new Date("2027-05-01"),
    newMaturityDate: new Date("2027-11-01"),
    renewedAt: new Date("2027-05-01"),
    renewedBy: new mongoose.Types.ObjectId(),
    settingsVersion: 1,
    interestSettled: 3000,
    renewalFeePaid: 500,
    notes: "Renewal test",
    ...overrides,
  });
};

test("Accept valid renewal history record", async () => {
  const renewal = createValidRenewal();

  await renewal.validate();

  assert.equal(renewal.settingsVersion, 1);
  assert.equal(renewal.interestSettled, 3000);
  assert.equal(renewal.renewalFeePaid, 500);
});

test("Reject missing pawn loan", async () => {
  const renewal = createValidRenewal({
    pawnLoan: undefined,
  });

  await assert.rejects(
    renewal.validate(),
    /pawnLoan/
  );
});

test("Reject invalid idempotency key", async () => {
  const renewal = createValidRenewal({
    idempotencyKey: "short",
  });

  await assert.rejects(
    renewal.validate(),
    /idempotencyKey/
  );
});

test("Reject invalid renewal dates", async () => {
  const renewal = createValidRenewal({
    newMaturityDate: new Date("2027-04-01"),
  });

  await assert.rejects(
    renewal.validate(),
    /New maturity date must be after previous maturity date/
  );
});

test("Reject negative interest settlement", async () => {
  const renewal = createValidRenewal({
    interestSettled: -100,
  });

  await assert.rejects(
    renewal.validate(),
    /interestSettled/
  );
});

test("Reject negative renewal fee", async () => {
  const renewal = createValidRenewal({
    renewalFeePaid: -50,
  });

  await assert.rejects(
    renewal.validate(),
    /renewalFeePaid/
  );
});

test("Reject missing renewedBy", async () => {
  const renewal = createValidRenewal({
    renewedBy: undefined,
  });

  await assert.rejects(
    renewal.validate(),
    /renewedBy/
  );
});

test("Reject invalid settings version", async () => {
  const renewal = createValidRenewal({
    settingsVersion: 0,
  });

  await assert.rejects(
    renewal.validate(),
    /settingsVersion/
  );
});

test("Reject notes longer than 500 characters", async () => {
  const renewal = createValidRenewal({
    notes: "A".repeat(501),
  });

  await assert.rejects(
    renewal.validate(),
    /notes/
  );
});


test("Reject excessive interest decimal places", async () => {
  const renewal = createValidRenewal({
    interestSettled: 100.123,
  });

  await assert.rejects(
    renewal.validate(),
    /interestSettled/
  );
});

test("Reject excessive renewal fee decimal places", async () => {
  const renewal = createValidRenewal({
    renewalFeePaid: 50.123,
  });

  await assert.rejects(
    renewal.validate(),
    /renewalFeePaid/
  );
});
