
import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSecurePaymentReplay,
} from "../services/securePaymentReplayService.js";

test("Reject missing payment request", async () => {
  await assert.rejects(
    checkSecurePaymentReplay({
      idempotencyKey: "valid-payment-key-123456",
      request: null,
      user: null,
    }),
    /Invalid payment request/
  );
});

test("Reject unauthenticated payment replay", async () => {
  await assert.rejects(
    checkSecurePaymentReplay({
      idempotencyKey: "valid-payment-key-123456",
      request: {
        pawnLoanId: "507f1f77bcf86cd799439011",
        amount: 5000,
        paymentMethod: "cash",
      },
      user: null,
    }),
    (error) => error.statusCode === 403
  );
});
