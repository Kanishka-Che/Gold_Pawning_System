
import test from "node:test";
import assert from "node:assert/strict";

import {
  validatePaymentRecord,
} from "../utils/paymentRecordValidator.js";

test("Accept valid split payment", () => {
  const result = validatePaymentRecord({
    amount: "5000.00",
    principalPaid: "3000.00",
    interestPaid: "2000.00",
  });

  assert.equal(result.valid, true);
});

test("Accept interest-only payment", () => {
  const result = validatePaymentRecord({
    amount: "2000.00",
    principalPaid: "0.00",
    interestPaid: "2000.00",
  });

  assert.equal(result.valid, true);
});

test("Accept principal-only payment", () => {
  const result = validatePaymentRecord({
    amount: "3000.00",
    principalPaid: "3000.00",
    interestPaid: "0.00",
  });

  assert.equal(result.valid, true);
});

test("Reject mismatched payment split", () => {
  assert.throws(() =>
    validatePaymentRecord({
      amount: "5000.00",
      principalPaid: "2000.00",
      interestPaid: "2000.00",
    })
  );
});

test("Reject zero payment", () => {
  assert.throws(() =>
    validatePaymentRecord({
      amount: "0.00",
      principalPaid: "0.00",
      interestPaid: "0.00",
    })
  );
});

test("Reject negative payment", () => {
  assert.throws(() =>
    validatePaymentRecord({
      amount: "-100.00",
      principalPaid: "0.00",
      interestPaid: "0.00",
    })
  );
});

test("Reject excessive decimal places", () => {
  assert.throws(() =>
    validatePaymentRecord({
      amount: "100.999",
      principalPaid: "100.00",
      interestPaid: "0.00",
    })
  );
});

test("Exact decimal split", () => {
  const result = validatePaymentRecord({
    amount: "0.30",
    principalPaid: "0.20",
    interestPaid: "0.10",
  });

  assert.equal(result.amount, "0.30");
  assert.equal(result.valid, true);
});
