
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  formatPaymentReplayResponse,
} from "../utils/paymentReplayResponse.js";

test("New payment keeps posting disabled", () => {
  const response = formatPaymentReplayResponse({
    status: "new",
    payment: null,
  });

  assert.equal(response.statusCode, 501);
  assert.equal(response.body.success, false);
});

test("Conflicting request returns 409 without payment details", () => {
  const response = formatPaymentReplayResponse({
    status: "conflict",
    payment: {
      amount: 5000,
      idempotencyKey: "private-payment-key-123",
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.payment, undefined);
});

test("Replay returns only approved payment fields", () => {
  const response = formatPaymentReplayResponse({
    status: "replay",
    payment: {
      _id: new mongoose.Types.ObjectId(),
      pawnLoan: new mongoose.Types.ObjectId(),
      idempotencyKey: "private-payment-key-123",
      amount: 5000,
      interestPaid: 1000,
      principalPaid: 4000,
      paymentMethod: "cash",
      paidAt: new Date("2026-11-20"),
      reference: "TEST-001",
      recordedBy: new mongoose.Types.ObjectId(),
      internalSecret: "DO-NOT-EXPOSE",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.replayed, true);
  assert.equal(response.body.payment.amount, 5000);

  assert.equal(
    response.body.payment.recordedBy,
    undefined
  );

  assert.equal(
    response.body.payment.idempotencyKey,
    undefined
  );

  assert.equal(
    response.body.payment.internalSecret,
    undefined
  );
});

test("Reject invalid replay result", () => {
  assert.throws(
    () => formatPaymentReplayResponse({ status: "unknown" }),
    /Invalid payment replay result/
  );
});

test("Reject replay without an existing payment", () => {
  assert.throws(
    () =>
      formatPaymentReplayResponse({
        status: "replay",
        payment: null,
      }),
    /Invalid existing payment record/
  );
});
