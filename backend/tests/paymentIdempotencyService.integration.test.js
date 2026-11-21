
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnPayment from "../models/PawnPayment.js";

import {
  findExistingPayment,
} from "../services/paymentIdempotencyService.js";

test("Payment idempotency lookup integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_replay_lookup_test_${randomUUID().replaceAll("-", "")}`;

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

    const payment = await PawnPayment.create({
      pawnLoan: loanId,
      idempotencyKey,
      amount: 1500,
      interestPaid: 500,
      principalPaid: 1000,
      paymentMethod: "cash",
      paidAt: new Date(),
      recordedBy: userId,
    });

    // Scenario 1: Existing payment lookup
    const existingPayment = await findExistingPayment({
      idempotencyKey,
    });

    assert.ok(existingPayment);

    assert.equal(
      existingPayment._id.toString(),
      payment._id.toString()
    );

    assert.equal(existingPayment.amount, 1500);

    console.log("Existing payment lookup: PASSED");

    // Scenario 2: Unknown key
    const missingPayment = await findExistingPayment({
      idempotencyKey: randomUUID(),
    });

    assert.equal(missingPayment, null);

    console.log("Unknown payment key returns null: PASSED");

    // Scenario 3: Lookup inside a transaction
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const paymentInTransaction = await findExistingPayment({
          idempotencyKey,
          session,
        });

        assert.ok(paymentInTransaction);

        assert.equal(
          paymentInTransaction._id.toString(),
          payment._id.toString()
        );
      });

      console.log("Transaction session lookup: PASSED");
    } finally {
      await session.endSession();
    }
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
