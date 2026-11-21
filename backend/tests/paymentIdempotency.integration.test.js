
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import PawnPayment from "../models/PawnPayment.js";

test("MongoDB rejects duplicate payment idempotency keys", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  // Use a separate, uniquely named test database.
  const testDbName =
    `sigiri_idempotency_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${testDbName}`;

  const connection = mongoose.createConnection(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  await connection.asPromise();

  try {
    // Register the schema on the isolated connection.
    const TestPawnPayment = connection.model(
      "PawnPayment",
      PawnPayment.schema
    );

    await TestPawnPayment.createIndexes();

    const payment = {
      pawnLoan: new mongoose.Types.ObjectId(),
      idempotencyKey: randomUUID(),
      amount: 5000,
      interestPaid: 1000,
      principalPaid: 4000,
      paymentMethod: "cash",
      paidAt: new Date(),
      recordedBy: new mongoose.Types.ObjectId(),
      reference: "Integration test only",
    };

    await TestPawnPayment.create(payment);

    await assert.rejects(
      () => TestPawnPayment.create({
        ...payment,
        _id: new mongoose.Types.ObjectId(),
      }),
      (error) => error.code === 11000
    );

    const count = await TestPawnPayment.countDocuments({
      idempotencyKey: payment.idempotencyKey,
    });

    assert.equal(count, 1);

    console.log(
      "Duplicate payment rejected successfully"
    );
  } finally {
    // Delete only this test's uniquely named database.
    await connection.dropDatabase();
    await connection.close();
  }
});
