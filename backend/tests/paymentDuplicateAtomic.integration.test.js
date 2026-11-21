
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import AuditLog from "../models/AuditLog.js";

import { withPaymentTransaction } from "../services/paymentTransactionService.js";
import { incrementLoanPaymentVersion } from "../services/loanPaymentVersionService.js";

test("Duplicate payment cannot modify loan or audit", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_duplicate_atomic_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await Promise.all([
      PawnLoan.init(),
      PawnPayment.init(),
      AuditLog.init(),
    ]);

    const loanId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const idempotencyKey = randomUUID();

    await PawnLoan.collection.insertOne({
      _id: loanId,
      loanNumber: `TEST-DUPLICATE-${randomUUID()}`,
      status: "active",
      paymentVersion: 0,
    });

    const recordPayment = async (expectedVersion) => {
      return withPaymentTransaction(async (session) => {
        // Update the loan first, so a duplicate
        // payment failure must roll it back.
        await incrementLoanPaymentVersion({
          loanId: loanId.toString(),
          expectedVersion,
          session,
        });

        const payments = await PawnPayment.create(
          [{
            pawnLoan: loanId,
            idempotencyKey,
            amount: 1000,
            interestPaid: 300,
            principalPaid: 700,
            paymentMethod: "cash",
            paidAt: new Date(),
            recordedBy: userId,
          }],
          { session }
        );

        await AuditLog.create(
          [{
            actor: userId,
            action: "PAWN_PAYMENT_RECORDED",
            targetType: "PawnPayment",
            targetId: payments[0]._id,
            details: {
              pawnLoanId: loanId.toString(),
              amount: 1000,
            },
          }],
          { session }
        );

        return payments[0]._id;
      });
    };

    // First payment succeeds.
    const firstPaymentId = await recordPayment(0);

    assert.ok(firstPaymentId);

    console.log("First payment committed: PASSED");

    // Same idempotency key must be rejected.
    await assert.rejects(
      () => recordPayment(1),
      (error) => error.code === 11000
    );

    console.log("Duplicate payment rejected: PASSED");

    // Exactly one payment must remain.
    const payments = await PawnPayment.find({
      pawnLoan: loanId,
    }).lean();

    assert.equal(payments.length, 1);
    assert.equal(
      payments[0]._id.toString(),
      firstPaymentId.toString()
    );

    console.log("No duplicate payment record: PASSED");

    // Duplicate attempt must not increment version.
    const loan = await PawnLoan.findById(loanId).lean();

    assert.equal(loan.paymentVersion, 1);

    console.log("Loan version rollback: PASSED");

    // Duplicate attempt must not add another audit.
    const audits = await AuditLog.find({
      action: "PAWN_PAYMENT_RECORDED",
      targetType: "PawnPayment",
    }).lean();

    assert.equal(audits.length, 1);
    assert.equal(
      audits[0].targetId.toString(),
      firstPaymentId.toString()
    );

    console.log("No duplicate audit record: PASSED");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
