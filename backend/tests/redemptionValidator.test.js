
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  validateRedemptionRequest,
  validateRedemptionEligibility,
  validateRedemptionGoldItems,
} from "../utils/redemptionValidator.js";

const loanId = new mongoose.Types.ObjectId().toString();
const goldId1 = new mongoose.Types.ObjectId().toString();
const goldId2 = new mongoose.Types.ObjectId().toString();

const makeLoan = () => ({
  _id: loanId,
  status: "active",
  goldItems: [goldId1, goldId2],
});

const makeGoldItems = () => [
  {
    _id: goldId1,
    status: "pledged",
    reservedForLoan: loanId,
  },
  {
    _id: goldId2,
    status: "pledged",
    reservedForLoan: loanId,
  },
];

test("Accept valid redemption request", () => {
  const result = validateRedemptionRequest({
    pawnLoanId: loanId,
    idempotencyKey: "redemption-test-key-12345",
    notes: "  Customer redemption  ",
  });

  assert.equal(result.pawnLoanId, loanId);
  assert.equal(
    result.notes,
    "Customer redemption"
  );
});

test("Reject invalid pawn loan ID", () => {
  assert.throws(
    () =>
      validateRedemptionRequest({
        pawnLoanId: "invalid-id",
        idempotencyKey: "redemption-test-key-12345",
      }),
    /invalid pawn loan id/i
  );
});

test("Reject invalid idempotency key", () => {
  assert.throws(
    () =>
      validateRedemptionRequest({
        pawnLoanId: loanId,
        idempotencyKey: "short",
      }),
    /invalid redemption idempotency key/i
  );
});

test("Reject invalid redemption notes", () => {
  assert.throws(
    () =>
      validateRedemptionRequest({
        pawnLoanId: loanId,
        idempotencyKey: "redemption-test-key-12345",
        notes: "x".repeat(501),
      }),
    /invalid redemption notes/i
  );
});

test("Accept eligible active loan", () => {
  assert.equal(
    validateRedemptionEligibility({
      loan: makeLoan(),
    }),
    true
  );
});

test("Reject draft loan redemption", () => {
  assert.throws(
    () =>
      validateRedemptionEligibility({
        loan: {
          ...makeLoan(),
          status: "draft",
        },
      }),
    /only active pawn loans/i
  );
});

test("Reject already redeemed loan", () => {
  assert.throws(
    () =>
      validateRedemptionEligibility({
        loan: {
          ...makeLoan(),
          status: "redeemed",
        },
      }),
    /only active pawn loans/i
  );
});

test("Reject loan without gold items", () => {
  assert.throws(
    () =>
      validateRedemptionEligibility({
        loan: {
          ...makeLoan(),
          goldItems: [],
        },
      }),
    /must contain gold items/i
  );
});

test("Reject duplicate gold items", () => {
  assert.throws(
    () =>
      validateRedemptionEligibility({
        loan: {
          ...makeLoan(),
          goldItems: [goldId1, goldId1],
        },
      }),
    /invalid or duplicate gold items/i
  );
});

test("Accept correctly pledged gold items", () => {
  assert.equal(
    validateRedemptionGoldItems({
      loan: makeLoan(),
      goldItems: makeGoldItems(),
    }),
    true
  );
});

test("Reject released gold item", () => {
  const items = makeGoldItems();
  items[0].status = "released";

  assert.throws(
    () =>
      validateRedemptionGoldItems({
        loan: makeLoan(),
        goldItems: items,
      }),
    /not currently pledged/i
  );
});

test("Reject gold item reserved for another loan", () => {
  const items = makeGoldItems();

  items[0].reservedForLoan =
    new mongoose.Types.ObjectId().toString();

  assert.throws(
    () =>
      validateRedemptionGoldItems({
        loan: makeLoan(),
        goldItems: items,
      }),
    /reservation does not match/i
  );
});

test("Reject missing gold item", () => {
  assert.throws(
    () =>
      validateRedemptionGoldItems({
        loan: makeLoan(),
        goldItems: [makeGoldItems()[0]],
      }),
    /gold item count does not match/i
  );
});

test("Reject unrelated gold item", () => {
  const items = makeGoldItems();

  items[0]._id =
    new mongoose.Types.ObjectId().toString();

  assert.throws(
    () =>
      validateRedemptionGoldItems({
        loan: makeLoan(),
        goldItems: items,
      }),
    /does not belong to this pawn loan/i
  );
});

test("Reject duplicate gold item in supplied records", () => {
  const items = makeGoldItems();
  items[1]._id = items[0]._id;

  assert.throws(
    () =>
      validateRedemptionGoldItems({
        loan: makeLoan(),
        goldItems: items,
      }),
    /does not belong to this pawn loan/i
  );
});
