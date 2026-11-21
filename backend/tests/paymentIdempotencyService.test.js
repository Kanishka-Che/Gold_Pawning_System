
import test from "node:test";
import assert from "node:assert/strict";

import {
  findExistingPayment,
} from "../services/paymentIdempotencyService.js";

test("Reject invalid payment idempotency keys", async () => {
  const invalidKeys = [
    null,
    undefined,
    "",
    "short",
    "invalid key with spaces",
    "invalid$key",
    "a".repeat(101),
    12345,
  ];

  for (const idempotencyKey of invalidKeys) {
    await assert.rejects(
      () => findExistingPayment({ idempotencyKey }),
      /Invalid payment idempotency key/
    );
  }
});
