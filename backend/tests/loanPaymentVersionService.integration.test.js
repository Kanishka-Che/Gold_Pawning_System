
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import {
  incrementLoanPaymentVersion,
} from "../services/loanPaymentVersionService.js";
import {
  withPaymentTransaction,
} from "../services/paymentTransactionService.js";

test("Atomic loan payment version integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_loan_version_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    // Insert minimal fixtures directly to isolate
    // the version-update behavior under test.
    const loans = PawnLoan.collection;

    const activeLoanId = new mongoose.Types.ObjectId();
    const draftLoanId = new mongoose.Types.ObjectId();

   
await loans.insertMany([
  {
    _id: activeLoanId,
    loanNumber: `TEST-ACTIVE-${randomUUID()}`,
    status: "active",
    paymentVersion: 0,
  },
  {
    _id: draftLoanId,
    loanNumber: `TEST-DRAFT-${randomUUID()}`,
    status: "draft",
    paymentVersion: 0,
  },
]);

    // 1. Correct version succeeds.
    const newVersion = await withPaymentTransaction(
      async (session) =>
        incrementLoanPaymentVersion({
          loanId: activeLoanId.toString(),
          expectedVersion: 0,
          session,
        })
    );

    assert.equal(newVersion, 1);

    let activeLoan = await loans.findOne({
      _id: activeLoanId,
    });

    assert.equal(activeLoan.paymentVersion, 1);

    // 2. Stale version is rejected.
    await assert.rejects(
      () =>
        withPaymentTransaction(async (session) =>
          incrementLoanPaymentVersion({
            loanId: activeLoanId.toString(),
            expectedVersion: 0,
            session,
          })
        ),
      (error) => error.statusCode === 409
    );

    // 3. Draft loan cannot be updated.
    await assert.rejects(
      () =>
        withPaymentTransaction(async (session) =>
          incrementLoanPaymentVersion({
            loanId: draftLoanId.toString(),
            expectedVersion: 0,
            session,
          })
        ),
      (error) => error.statusCode === 409
    );

    // 4. Version update rolls back on failure.
    await assert.rejects(
      () =>
        withPaymentTransaction(async (session) => {
          await incrementLoanPaymentVersion({
            loanId: activeLoanId.toString(),
            expectedVersion: 1,
            session,
          });

          throw new Error("Simulated rollback");
        }),
      /Simulated rollback/
    );

    activeLoan = await loans.findOne({
      _id: activeLoanId,
    });

    assert.equal(activeLoan.paymentVersion, 1);

    console.log("Correct version update: PASSED");
    console.log("Stale version rejection: PASSED");
    console.log("Inactive loan rejection: PASSED");
    console.log("Transaction rollback: PASSED");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
