
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";

import {
  verifyPaymentLoanAccess,
} from "../services/paymentLoanAccessService.js";

test("Payment loan access MongoDB integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_loan_access_test_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  await mongoose.connect(uri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await PawnLoan.init();

    const userId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    const goldItemId = new mongoose.Types.ObjectId();

    const user = {
      _id: userId,
      role: "staff",
      isActive: true,
    };

    const loan = await PawnLoan.create({
      loanNumber: `TEST-${randomUUID()}`,
      customer: customerId,
      goldItems: [goldItemId],
      principalAmount: 100000,
      interestRate: 2,
      issueDate: new Date("2026-11-01"),
      maturityDate: new Date("2027-05-01"),
      settingsVersion: 1,
      createdBy: userId,
      status: "active",
    });

    // Scenario 1: Existing loan
    const foundLoan = await verifyPaymentLoanAccess({
      loanId: loan._id,
      user,
    });

    assert.equal(
      foundLoan._id.toString(),
      loan._id.toString()
    );

    assert.equal(foundLoan.status, "active");
    assert.equal(foundLoan.paymentVersion, 0);

    console.log("Existing loan access: PASSED");

    // Scenario 2: Unknown loan
    await assert.rejects(
      verifyPaymentLoanAccess({
        loanId: new mongoose.Types.ObjectId(),
        user,
      }),
      (error) => error.statusCode === 404
    );

    console.log("Unknown loan rejected: PASSED");

    // Scenario 3: Transaction session lookup
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const loanInTransaction =
          await verifyPaymentLoanAccess({
            loanId: loan._id,
            user,
            session,
          });

        assert.equal(
          loanInTransaction._id.toString(),
          loan._id.toString()
        );
      });

      console.log("Transaction loan access: PASSED");
    } finally {
      await session.endSession();
    }

    // Scenario 4: Redeemed loan remains readable
    await PawnLoan.updateOne(
      { _id: loan._id },
      { $set: { status: "redeemed" } }
    );

    const redeemedLoan = await verifyPaymentLoanAccess({
      loanId: loan._id,
      user,
    });

    assert.equal(redeemedLoan.status, "redeemed");

    console.log("Redeemed loan lookup: PASSED");

  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
