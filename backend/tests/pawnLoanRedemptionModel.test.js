
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

const newId = () => new mongoose.Types.ObjectId();

const makeRedemption = (overrides = {}) => ({
  pawnLoan: newId(),
  idempotencyKey: "redemption-test-key-123456",
  redeemedAt: new Date(),
  redeemedBy: newId(),
  settingsVersion: 1,
  principalSettled: 10000,
  interestSettled: 500,
  penaltySettled: 100,
  totalSettled: 10600,
  releasedGoldItems: [newId(), newId()],
  notes: "Customer redeemed gold",
  ...overrides,
});

const validate = async (overrides = {}) => {
  const redemption = new PawnLoanRedemption(
    makeRedemption(overrides)
  );

  await redemption.validate();

  return redemption;
};

test("Accept valid redemption record", async () => {
  const redemption = await validate();

  assert.equal(redemption.totalSettled, 10600);
  assert.equal(redemption.releasedGoldItems.length, 2);
});

test("Reject missing pawn loan", async () => {
  await assert.rejects(
    validate({ pawnLoan: undefined }),
    /pawnLoan.*required/i
  );
});

test("Reject invalid idempotency key", async () => {
  await assert.rejects(
    validate({ idempotencyKey: "short" }),
    /idempotencyKey/i
  );
});

test("Reject missing redeemedBy", async () => {
  await assert.rejects(
    validate({ redeemedBy: undefined }),
    /redeemedBy.*required/i
  );
});

test("Reject invalid settings version", async () => {
  await assert.rejects(
    validate({ settingsVersion: 0 }),
    /settingsVersion/i
  );
});

test("Reject negative principal settlement", async () => {
  await assert.rejects(
    validate({ principalSettled: -100 }),
    /principalSettled/i
  );
});

test("Reject excessive interest decimal places", async () => {
  await assert.rejects(
    validate({ interestSettled: 10.123 }),
    /interestSettled/i
  );
});

test("Reject negative penalty settlement", async () => {
  await assert.rejects(
    validate({ penaltySettled: -1 }),
    /penaltySettled/i
  );
});

test("Reject inconsistent total settlement", async () => {
  await assert.rejects(
    validate({ totalSettled: 10500 }),
    /totalSettled/i
  );
});

test("Reject missing released gold items", async () => {
  await assert.rejects(
    validate({ releasedGoldItems: [] }),
    /releasedGoldItems/i
  );
});

test("Reject duplicate released gold items", async () => {
  const goldId = newId();

  await assert.rejects(
    validate({
      releasedGoldItems: [goldId, goldId],
    }),
    /releasedGoldItems/i
  );
});

test("Reject notes longer than 500 characters", async () => {
  await assert.rejects(
    validate({ notes: "x".repeat(501) }),
    /notes/i
  );
});

test("Accept exact decimal settlement", async () => {
  const redemption = await validate({
    principalSettled: 1000.10,
    interestSettled: 20.20,
    penaltySettled: 0.30,
    totalSettled: 1020.60,
  });

  assert.equal(
    Math.round(redemption.totalSettled * 100),
    102060
  );
});

test("Reject missing redemption date", async () => {
  await assert.rejects(
    validate({ redeemedAt: undefined }),
    /redeemedAt.*required/i
  );
});

test("Reject invalid total settlement", async () => {
  await assert.rejects(
    validate({ totalSettled: -1 }),
    /totalSettled/i
  );
});
