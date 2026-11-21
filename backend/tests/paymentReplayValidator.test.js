
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  validatePaymentReplay,
} from "../utils/paymentReplayValidator.js";

const loanId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

const existingPayment = {
  pawnLoan: loanId,
  amount: 5000,
  paymentMethod: "cash",
  reference: "Receipt-001",
  recordedBy: userId,
};

const request = {
  pawnLoanId: loanId.toString(),
  amount: 5000,
  paymentMethod: "cash",
  reference: "Receipt-001",
  recordedBy: userId.toString(),
};

test("Accept identical payment retry", () => {
  assert.equal(
    validatePaymentReplay({ existingPayment, request }),
    "replay"
  );
});

test("Reject retry with different amount", () => {
  assert.equal(
    validatePaymentReplay({
      existingPayment,
      request: { ...request, amount: 6000 },
    }),
    "conflict"
  );
});

test("Reject retry with different loan", () => {
  assert.equal(
    validatePaymentReplay({
      existingPayment,
      request: {
        ...request,
        pawnLoanId: new mongoose.Types.ObjectId().toString(),
      },
    }),
    "conflict"
  );
});

test("Reject retry with different payment method", () => {
  assert.equal(
    validatePaymentReplay({
      existingPayment,
      request: { ...request, paymentMethod: "bank_transfer" },
    }),
    "conflict"
  );
});

test("Reject retry with different reference", () => {
  assert.equal(
    validatePaymentReplay({
      existingPayment,
      request: { ...request, reference: "Receipt-002" },
    }),
    "conflict"
  );
});

test("Reject retry recorded by different cashier", () => {
  assert.equal(
    validatePaymentReplay({
      existingPayment,
      request: {
        ...request,
        recordedBy: new mongoose.Types.ObjectId().toString(),
      },
    }),
    "conflict"
  );
});

test("Reject invalid replay comparison", () => {
  assert.throws(
    () =>
      validatePaymentReplay({
        existingPayment: null,
        request,
      }),
    /Invalid payment replay comparison/
  );
});
