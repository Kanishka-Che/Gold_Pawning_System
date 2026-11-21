
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";

import {
  checkSecurePaymentReplay,
} from "../services/securePaymentReplayService.js";

test("Secure payment replay MongoDB integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_secure_replay_${randomUUID().replaceAll("-", "")}`;

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

    const request = {
      pawnLoanId: loanId.toString(),
      amount: 5000,
      paymentMethod: "cash",
      reference: "SECURE-001",
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

    // Scenario 1: New payment request
    const newResult = await checkSecurePaymentReplay({
      idempotencyKey,
      request,
      user,
    });

    assert.equal(newResult.status, "new");
    assert.equal(newResult.payment, null);

    console.log("Authorized new request: PASSED");

    // Insert a test payment directly into MongoDB.
    const payment = await PawnPayment.create({
      pawnLoan: loanId,
      idempotencyKey,
      amount: 5000,
      interestPaid: 1000,
      principalPaid: 4000,
      paymentMethod: "cash",
      paidAt: new Date(),
      recordedBy: userId,
      reference: "SECURE-001",
    });

    // Scenario 2: Same payment retry
    const replayResult = await checkSecurePaymentReplay({
      idempotencyKey,
      request,
      user,
    });

    assert.equal(replayResult.status, "replay");

    assert.equal(
      String(replayResult.payment._id),
      String(payment._id)
    );

    console.log("Authorized payment replay: PASSED");

    // Scenario 3: Different amount, same key
    const conflictResult = await checkSecurePaymentReplay({
      idempotencyKey,
      request: {
        ...request,
        amount: 6000,
      },
      user,
    });

    assert.equal(conflictResult.status, "conflict");

    console.log("Payment conflict detection: PASSED");

    // Scenario 4: Inactive user
    await assert.rejects(
      checkSecurePaymentReplay({
        idempotencyKey,
        request,
        user: {
          ...user,
          isActive: false,
        },
      }),
      (error) => error.statusCode === 403
    );

    console.log("Inactive user blocked: PASSED");

    // Scenario 5: Redeemed loan can be read for replay
    await PawnLoan.updateOne(
      { _id: loanId },
      { $set: { status: "redeemed" } }
    );

    const redeemedReplay = await checkSecurePaymentReplay({
      idempotencyKey,
      request,
      user,
    });

    assert.equal(redeemedReplay.status, "replay");
    assert.equal(redeemedReplay.loan.status, "redeemed");

    console.log("Redeemed loan replay: PASSED");

    // Scenario 6: Read-only verification
    const paymentCount = await PawnPayment.countDocuments({
      idempotencyKey,
    });

    assert.equal(paymentCount, 1);

    const updatedLoan = await PawnLoan.findById(loanId);

    assert.equal(updatedLoan.paymentVersion, 0);

    console.log("No duplicate payment or version update: PASSED");

  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
