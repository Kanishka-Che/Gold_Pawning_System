
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import {
  incrementLoanPaymentVersion,
} from "../services/loanPaymentVersionService.js";

test("Concurrent loan transactions cannot both claim the same version", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_concurrency_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  let sessionA;
  let sessionB;

  try {
    const loanId = new mongoose.Types.ObjectId();

    // Minimal isolated test fixture.
    
await PawnLoan.init();

await PawnLoan.collection.insertOne({
  _id: loanId,
  loanNumber: `TEST-CONCURRENT-${randomUUID()}`,
  status: "active",
  paymentVersion: 0,
});

// Make sure the test collection and indexes
// are initialized before starting transactions.
await PawnLoan.collection.createIndex(
  { loanNumber: 1 },
  { unique: true }
);

sessionA = await mongoose.startSession();
sessionB = await mongoose.startSession();


    sessionA.startTransaction();
    sessionB.startTransaction();

    // Both cashiers read version 0 while
    // their transactions are open.
    const [loanA, loanB] = await Promise.all([
      PawnLoan.findById(loanId).session(sessionA).lean(),
      PawnLoan.findById(loanId).session(sessionB).lean(),
    ]);

    assert.equal(loanA.paymentVersion, 0);
    assert.equal(loanB.paymentVersion, 0);

    // Cashier A claims version 0 and commits.
    const versionA = await incrementLoanPaymentVersion({
      loanId: loanId.toString(),
      expectedVersion: loanA.paymentVersion,
      session: sessionA,
    });

    assert.equal(versionA, 1);

    await sessionA.commitTransaction();

    // Cashier B still has the old snapshot.
    // Its update must not commit successfully.
    let secondUpdateRejected = false;

    try {
      await incrementLoanPaymentVersion({
        loanId: loanId.toString(),
        expectedVersion: loanB.paymentVersion,
        session: sessionB,
      });

      await sessionB.commitTransaction();
    } catch (error) {
      secondUpdateRejected = true;

      assert.ok(
        error.statusCode === 409 ||
        error.code === 112 ||
        error.hasErrorLabel?.("TransientTransactionError"),
        `Unexpected error: ${error.message}`
      );
    }

    assert.equal(secondUpdateRejected, true);

    if (sessionB.inTransaction()) {
      await sessionB.abortTransaction();
    }

    const finalLoan = await PawnLoan.findById(loanId).lean();

    assert.equal(finalLoan.paymentVersion, 1);

    console.log("First transaction committed: PASSED");
    console.log("Stale concurrent transaction rejected: PASSED");
    console.log("Final paymentVersion = 1: PASSED");
  } finally {
    if (sessionA?.inTransaction()) {
      await sessionA.abortTransaction();
    }

    if (sessionB?.inTransaction()) {
      await sessionB.abortTransaction();
    }

    await sessionA?.endSession();
    await sessionB?.endSession();

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
