
import test from "node:test";
import assert from "node:assert/strict";

import {
  withPaymentTransaction,
} from "../services/paymentTransactionService.js";

test(
  "Reject invalid payment transaction operation",
  async () => {
    await assert.rejects(
      () => withPaymentTransaction(null),
      TypeError
    );

    await assert.rejects(
      () => withPaymentTransaction("invalid"),
      TypeError
    );
  }
);
