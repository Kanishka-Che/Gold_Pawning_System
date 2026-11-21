
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import {
  createPawnPayment,
} from "../controllers/pawnPaymentController.js";

const createMockResponse = () => {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };
};

const validRequest = () => ({
  pawnLoanId: new mongoose.Types.ObjectId().toString(),
  amount: 5000,
  paymentMethod: "cash",
  reference: "",
  idempotencyKey: randomUUID(),
});

const invalidCases = [
  {
    name: "Reject negative payment amount",
    changes: { amount: -100 },
    message: /invalid payment amount/i,
  },
  {
    name: "Reject zero payment amount",
    changes: { amount: 0 },
    message: /invalid payment amount/i,
  },
  {
    name: "Reject excessive decimal places",
    changes: { amount: 100.123 },
    message: /at most two decimal places/i,
  },
  {
    name: "Reject unsupported payment method",
    changes: { paymentMethod: "credit_card" },
    message: /invalid payment method/i,
  },
  {
    name: "Reject unexpected payment fields",
    changes: { recordedBy: "fake-user" },
    message: /invalid payment request fields/i,
  },
];

for (const scenario of invalidCases) {
  test(scenario.name, async () => {
    const req = {
      body: {
        ...validRequest(),
        ...scenario.changes,
      },
      user: {
        _id: new mongoose.Types.ObjectId(),
        role: "staff",
        isActive: true,
      },
    };

    const res = createMockResponse();

    await createPawnPayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, scenario.message);

    console.log(`${scenario.name}: PASSED`);
  });
}


const additionalInvalidCases = [
  {
    name: "Reject invalid pawn loan ID",
    changes: { pawnLoanId: "invalid-loan-id" },
    message: /invalid pawn loan id/i,
  },
  {
    name: "Reject invalid payment reference",
    changes: { reference: "A".repeat(151) },
    message: /invalid payment reference/i,
  },
  {
    name: "Reject invalid idempotency key",
    changes: { idempotencyKey: "short" },
    message: /invalid payment idempotency key/i,
  },
  {
    name: "Reject non-numeric amount",
    changes: { amount: "5000" },
    message: /invalid payment amount/i,
  },
  {
    name: "Reject missing payment method",
    changes: { paymentMethod: undefined },
    message: /invalid payment method/i,
  },
];

for (const scenario of additionalInvalidCases) {
  test(scenario.name, async () => {
    const req = {
      body: {
        ...validRequest(),
        ...scenario.changes,
      },
      user: {
        _id: new mongoose.Types.ObjectId(),
        role: "staff",
        isActive: true,
      },
    };

    const res = createMockResponse();

    await createPawnPayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, scenario.message);

    console.log(`${scenario.name}: PASSED`);
  });
}
