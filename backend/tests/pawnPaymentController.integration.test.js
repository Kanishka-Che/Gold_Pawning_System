
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";

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

test("Authenticated payment replay controller integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_payment_controller_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await PawnLoan.init();
    await PawnPayment.init();

    const userId = new mongoose.Types.ObjectId();
    const loanId = new mongoose.Types.ObjectId();
    const idempotencyKey = randomUUID();

    const user = {
      _id: userId,
      role: "staff",
      isActive: true,
    };

    const body = {
      pawnLoanId: loanId.toString(),
      amount: 5000,
      paymentMethod: "cash",
      reference: "CTRL-001",
      idempotencyKey,
    };

    await PawnLoan.create({
      _id: loanId,
      loanNumber: `TEST-${randomUUID()}`,
      customer: new mongoose.Types.ObjectId(),
      goldItems: [new mongoose.Types.ObjectId()],
      principalAmount: 100000,
      interestRate: 2,
      issueDate: new Date("2026-11-01"),
      maturityDate: new Date("2027-05-01"),
      settingsVersion: 1,
      createdBy: userId,
      status: "active",
    });

    // Scenario 1: New payment remains disabled
    const newResponse = makeResponse();

    await createPawnPayment(
      { body, user },
      newResponse
    );

    assert.equal(newResponse.statusCode, 501);
    assert.equal(newResponse.body.success, false);

    console.log("New payment remains disabled: PASSED");

    // Insert a test payment directly
    const payment = await PawnPayment.create({
      pawnLoan: loanId,
      idempotencyKey,
      amount: 5000,
      interestPaid: 1000,
      principalPaid: 4000,
      paymentMethod: "cash",
      paidAt: new Date(),
      recordedBy: userId,
      reference: "CTRL-001",
    });

    // Scenario 2: Identical retry
    const replayResponse = makeResponse();

    await createPawnPayment(
      { body, user },
      replayResponse
    );

    assert.equal(replayResponse.statusCode, 200);
    assert.equal(replayResponse.body.replayed, true);

    assert.equal(
      replayResponse.body.payment.id,
      String(payment._id)
    );

    assert.equal(
      replayResponse.body.payment.recordedBy,
      undefined
    );

    console.log("Authorized payment replay: PASSED");

    // Scenario 3: Same key, different amount
    const conflictResponse = makeResponse();

    await createPawnPayment(
      {
        body: {
          ...body,
          amount: 6000,
        },
        user,
      },
      conflictResponse
    );

    assert.equal(conflictResponse.statusCode, 409);
    assert.equal(conflictResponse.body.success, false);
    assert.equal(conflictResponse.body.payment, undefined);

    console.log("Payment conflict response: PASSED");

    // Scenario 4: Unknown loan
    const missingResponse = makeResponse();

    await createPawnPayment(
      {
        body: {
          ...body,
          pawnLoanId: new mongoose.Types.ObjectId().toString(),
          idempotencyKey: randomUUID(),
        },
        user,
      },
      missingResponse
    );

    assert.equal(missingResponse.statusCode, 404);

    console.log("Unknown loan response: PASSED");

    // Scenario 5: Verify no duplicate payment
    assert.equal(
      await PawnPayment.countDocuments({ idempotencyKey }),
      1
    );

    const updatedLoan = await PawnLoan.findById(loanId);

    assert.equal(updatedLoan.paymentVersion, 0);

    console.log("No payment duplication: PASSED");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
