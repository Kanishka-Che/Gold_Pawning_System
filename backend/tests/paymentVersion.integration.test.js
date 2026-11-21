
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

test("Reject stale loan payment version", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const databaseName =
    `sigiri_version_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${databaseName}`;

  const connection = mongoose.createConnection(
    uri.toString(),
    { serverSelectionTimeoutMS: 5000 }
  );

  await connection.asPromise();

  try {
    const loans = connection.db.collection(
      "payment_version_test_loans"
    );

    const loanId = new mongoose.Types.ObjectId();

    await loans.insertOne({
      _id: loanId,
      paymentVersion: 0,
    });

    // Cashier A and Cashier B read version 0.
    const cashierAVersion = 0;
    const cashierBVersion = 0;

    // Cashier A successfully updates the version.
    const firstUpdate = await loans.updateOne(
      {
        _id: loanId,
        paymentVersion: cashierAVersion,
      },
      {
        $inc: { paymentVersion: 1 },
      }
    );

    assert.equal(firstUpdate.modifiedCount, 1);

    // Cashier B attempts an update using stale version 0.
    const secondUpdate = await loans.updateOne(
      {
        _id: loanId,
        paymentVersion: cashierBVersion,
      },
      {
        $inc: { paymentVersion: 1 },
      }
    );

    assert.equal(secondUpdate.modifiedCount, 0);

    const loan = await loans.findOne({
      _id: loanId,
    });

    assert.equal(loan.paymentVersion, 1);

    console.log(
      "Stale payment version rejected successfully"
    );
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
