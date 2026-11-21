
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import AuditLog from "../models/AuditLog.js";

import {
  withPaymentTransaction,
} from "../services/paymentTransactionService.js";

import {
  incrementLoanPaymentVersion,
} from "../services/loanPaymentVersionService.js";

test("Payment and audit atomic transaction integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_payment_atomic_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    // Ensure collections and indexes exist
    // before starting transactions.
    await Promise.all([
      PawnLoan.init(),
      PawnPayment.init(),
      AuditLog.init(),
    ]);

    const loanId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    // Isolated minimal test loan.
    await PawnLoan.collection.insertOne({
      _id: loanId,
      loanNumber: `TEST-ATOMIC-${randomUUID()}`,
      status: "active",
      paymentVersion: 0,
    });

    // ------------------------------------
    // Scenario A: Successful transaction
    // ------------------------------------

    const successfulKey = randomUUID();

    const paymentId = await withPaymentTransaction(
      async (session) => {
        const payments = await PawnPayment.create(
          [
            {
              pawnLoan: loanId,
              idempotencyKey: successfulKey,
              amount: 1000,
              interestPaid: 300,
              principalPaid: 700,
              paymentMethod: "cash",
              paidAt: new Date(),
              recordedBy: userId,
            },
          ],
          { session }
        );

        await incrementLoanPaymentVersion({
          loanId: loanId.toString(),
          expectedVersion: 0,
          session,
        });

        await AuditLog.create(
          [
            {
              actor: userId,
              action: "PAWN_PAYMENT_RECORDED",
              targetType: "PawnPayment",
              targetId: payments[0]._id,
              details: {
                pawnLoanId: loanId.toString(),
                amount: 1000,
              },
            },
          ],
          { session }
        );

        return payments[0]._id;
      }
    );

    assert.ok(paymentId);

    assert.equal(
      await PawnPayment.countDocuments({
        pawnLoan: loanId,
      }),
      1
    );

    assert.equal(
      await AuditLog.countDocuments({
        action: "PAWN_PAYMENT_RECORDED",
        targetId: paymentId,
      }),
      1
    );

    let loan = await PawnLoan.findById(loanId).lean();

    assert.equal(loan.paymentVersion, 1);

    console.log(
      "Payment + version + audit commit: PASSED"
    );

    // ------------------------------------
    // Scenario B: Audit failure rollback
    // ------------------------------------

    const failedKey = randomUUID();

    await assert.rejects(
      () =>
        withPaymentTransaction(async (session) => {
          await PawnPayment.create(
            [
              {
                pawnLoan: loanId,
                idempotencyKey: failedKey,
                amount: 500,
                interestPaid: 100,
                principalPaid: 400,
                paymentMethod: "cash",
                paidAt: new Date(),
                recordedBy: userId,
              },
            ],
            { session }
          );

          await incrementLoanPaymentVersion({
            loanId: loanId.toString(),
            expectedVersion: 1,
            session,
          });

          // Missing required actor:
          // deliberately force audit validation failure.
          await AuditLog.create(
            [
              {
                action: "PAWN_PAYMENT_RECORDED",
                targetType: "PawnPayment",
                targetId: new mongoose.Types.ObjectId(),
                details: {
                  simulatedFailure: true,
                },
              },
            ],
            { session }
          );
        }),
      (error) => error.name === "ValidationError"
    );

    // Failed payment must not exist.
    assert.equal(
      await PawnPayment.countDocuments({
        idempotencyKey: failedKey,
      }),
      0
    );

    // Only the first successful payment remains.
    assert.equal(
      await PawnPayment.countDocuments({
        pawnLoan: loanId,
      }),
      1
    );

    // Only the successful audit remains.
    assert.equal(
      await AuditLog.countDocuments({
        action: "PAWN_PAYMENT_RECORDED",
      }),
      1
    );

    // Version increment from failed transaction
    // must be rolled back.
    loan = await PawnLoan.findById(loanId).lean();

    assert.equal(loan.paymentVersion, 1);

    console.log(
      "Audit failure rolls back payment: PASSED"
    );

    console.log(
      "Audit failure rolls back loan version: PASSED"
    );

    console.log(
      "Successful audit remains unchanged: PASSED"
    );
  } finally {
    // This database has a unique test-only name.
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
