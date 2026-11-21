
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

test("Payment and audit log rollback together", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_rollback_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  const connection = mongoose.createConnection(
    uri.toString(),
    { serverSelectionTimeoutMS: 5000 }
  );

  await connection.asPromise();

  try {
    const payments = connection.db.collection(
      "rollback_test_payments"
    );

    const auditLogs = connection.db.collection(
      "rollback_test_audit_logs"
    );

    const loans = connection.db.collection(
      "rollback_test_loans"
    );

    const loanId = new mongoose.Types.ObjectId();

    await loans.insertOne({
      _id: loanId,
      paymentVersion: 0,
    });

    const session = await connection.startSession();

    try {
      await assert.rejects(
        () =>
          session.withTransaction(async () => {
            const versionUpdate = await loans.updateOne(
              {
                _id: loanId,
                paymentVersion: 0,
              },
              {
                $inc: { paymentVersion: 1 },
              },
              { session }
            );

            assert.equal(
              versionUpdate.modifiedCount,
              1
            );

            await payments.insertOne(
              {
                pawnLoan: loanId,
                amount: 5000,
                idempotencyKey: randomUUID(),
              },
              { session }
            );

            await auditLogs.insertOne(
              {
                action: "PAWN_PAYMENT_RECORDED",
                targetId: loanId,
              },
              { session }
            );

            throw new Error(
              "Simulated transaction failure"
            );
          }),
        /Simulated transaction failure/
      );
    } finally {
      await session.endSession();
    }

    const paymentCount =
      await payments.countDocuments();

    const auditCount =
      await auditLogs.countDocuments();

    const loan = await loans.findOne({
      _id: loanId,
    });

    assert.equal(paymentCount, 0);
    assert.equal(auditCount, 0);
    assert.equal(loan.paymentVersion, 0);

    console.log(
      "Payment, audit and loan version rollback: PASSED"
    );
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
