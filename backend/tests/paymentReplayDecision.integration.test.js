
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnPayment from "../models/PawnPayment.js";

import {
  checkPaymentReplay,
} from "../services/paymentReplayDecisionService.js";

test("Payment replay decision integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_replay_decision_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await PawnPayment.init();

    const loanId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const idempotencyKey = randomUUID();

    const request = {
      pawnLoanId: loanId.toString(),
      amount: 5000,
      paymentMethod: "cash",
      reference: "TEST-001",
      recordedBy: userId.toString(),
    };

    // Scenario 1: New payment request
    const newResult = await checkPaymentReplay({
      idempotencyKey,
      request,
    });

    assert.equal(newResult.status, "new");
    assert.equal(newResult.payment, null);

    console.log("New payment detection: PASSED");

    // Create a test payment directly.
    const payment = await PawnPayment.create({
      pawnLoan: loanId,
      idempotencyKey,
      amount: 5000,
      interestPaid: 1000,
      principalPaid: 4000,
      paymentMethod: "cash",
      paidAt: new Date(),
      recordedBy: userId,
      reference: "TEST-001",
    });

    // Scenario 2: Identical retry
    const replayResult = await checkPaymentReplay({
      idempotencyKey,
      request,
    });

    assert.equal(replayResult.status, "replay");

    assert.equal(
      replayResult.payment._id.toString(),
      payment._id.toString()
    );

    console.log("Identical payment replay: PASSED");

    // Scenario 3: Changed amount
    const conflictResult = await checkPaymentReplay({
      idempotencyKey,
      request: {
        ...request,
        amount: 6000,
      },
    });

    assert.equal(conflictResult.status, "conflict");

    console.log("Different payment conflict: PASSED");

    // Lookup must not create additional payments.
    assert.equal(
      await PawnPayment.countDocuments({ idempotencyKey }),
      1
    );

    console.log("Read-only replay verification: PASSED");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
