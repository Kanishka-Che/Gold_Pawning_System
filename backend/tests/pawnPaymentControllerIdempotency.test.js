
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import {
  createPawnPayment,
} from "../controllers/pawnPaymentController.js";

const makeResponse = () => ({
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
});

const makeRequest = (overrides = {}) => ({
  body: {
    pawnLoanId: new mongoose.Types.ObjectId().toString(),
    amount: 5000,
    paymentMethod: "cash",
    reference: "",
    idempotencyKey: randomUUID(),
    ...overrides,
  },
});


test("Reject unauthenticated valid payment request", async () => {
  const res = makeResponse();

  await createPawnPayment(makeRequest(), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);

  assert.match(
    res.body.message,
    /not authorized/i
  );
});


test("Reject missing idempotency key", async () => {
  const req = makeRequest();
  delete req.body.idempotencyKey;

  const res = makeResponse();

  await createPawnPayment(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /idempotency key/i);
});

test("Reject invalid idempotency key", async () => {
  const res = makeResponse();

  await createPawnPayment(
    makeRequest({ idempotencyKey: "invalid key!" }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /idempotency key/i);
});

test("Reject unexpected payment fields", async () => {
  const res = makeResponse();

  await createPawnPayment(
    makeRequest({ interestPaid: 1000 }),
    res
  );

  assert.equal(res.statusCode, 400);
});
