
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  validateRenewalRequest,
  validateRenewalEligibility,
} from "../utils/renewalValidator.js";

const validLoanId = new mongoose.Types.ObjectId().toString();

const validRequest = {
  pawnLoanId: validLoanId,
  idempotencyKey: "renewal_test_key_123456",
  notes: "Customer requested renewal",
};

const activeLoan = {
  status: "active",
  settingsSnapshot: {
    renewal: {
      enabled: true,
    },
  },
};

test("Accept valid renewal request", () => {
  const result = validateRenewalRequest(validRequest);

  assert.equal(result.pawnLoanId, validLoanId);
  assert.equal(
    result.idempotencyKey,
    validRequest.idempotencyKey
  );
  assert.equal(result.notes, validRequest.notes);
});

test("Reject invalid pawn loan ID", () => {
  assert.throws(
    () =>
      validateRenewalRequest({
        ...validRequest,
        pawnLoanId: "invalid-id",
      }),
    /Invalid pawn loan ID/
  );
});

test("Reject invalid renewal idempotency key", () => {
  assert.throws(
    () =>
      validateRenewalRequest({
        ...validRequest,
        idempotencyKey: "short",
      }),
    /Invalid renewal idempotency key/
  );
});

test("Reject invalid renewal notes", () => {
  assert.throws(
    () =>
      validateRenewalRequest({
        ...validRequest,
        notes: "A".repeat(501),
      }),
    /Invalid renewal notes/
  );
});

test("Trim renewal notes", () => {
  const result = validateRenewalRequest({
    ...validRequest,
    notes: "  Renewal requested  ",
  });

  assert.equal(result.notes, "Renewal requested");
});

test("Accept eligible active loan", () => {
  assert.equal(
    validateRenewalEligibility({ loan: activeLoan }),
    true
  );
});

test("Reject draft loan renewal", () => {
  assert.throws(
    () =>
      validateRenewalEligibility({
        loan: {
          ...activeLoan,
          status: "draft",
        },
      }),
    /Only active loans can be renewed/
  );
});

test("Reject redeemed loan renewal", () => {
  assert.throws(
    () =>
      validateRenewalEligibility({
        loan: {
          ...activeLoan,
          status: "redeemed",
        },
      }),
    /Only active loans can be renewed/
  );
});

test("Reject renewal when disabled in loan snapshot", () => {
  assert.throws(
    () =>
      validateRenewalEligibility({
        loan: {
          ...activeLoan,
          settingsSnapshot: {
            renewal: {
              enabled: false,
            },
          },
        },
      }),
    /Loan renewal is not enabled/
  );
});

test("Reject missing loan", () => {
  assert.throws(
    () => validateRenewalEligibility({ loan: null }),
    /Invalid pawn loan/
  );
});
