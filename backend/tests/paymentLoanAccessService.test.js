
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  verifyPaymentLoanAccess,
} from "../services/paymentLoanAccessService.js";

const loanId = new mongoose.Types.ObjectId();

const validUser = {
  _id: new mongoose.Types.ObjectId(),
  role: "staff",
  isActive: true,
};

test("Reject invalid loan ID", async () => {
  await assert.rejects(
    verifyPaymentLoanAccess({
      loanId: "invalid-id",
      user: validUser,
    }),
    (error) => error.statusCode === 400
  );
});

test("Reject unauthenticated user", async () => {
  await assert.rejects(
    verifyPaymentLoanAccess({
      loanId,
      user: null,
    }),
    (error) => error.statusCode === 403
  );
});

test("Reject unauthorized role", async () => {
  await assert.rejects(
    verifyPaymentLoanAccess({
      loanId,
      user: {
        ...validUser,
        role: "customer",
      },
    }),
    (error) => error.statusCode === 403
  );
});

test("Reject inactive user", async () => {
  await assert.rejects(
    verifyPaymentLoanAccess({
      loanId,
      user: {
        ...validUser,
        isActive: false,
      },
    }),
    (error) => error.statusCode === 403
  );
});

test("Reject invalid MongoDB session", async () => {
  await assert.rejects(
    verifyPaymentLoanAccess({
      loanId,
      user: validUser,
      session: {},
    }),
    /Invalid MongoDB session/
  );
});
