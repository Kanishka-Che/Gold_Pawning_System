
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import LoanSettings from "../models/LoanSettings.js";
import PawnLoan from "../models/PawnLoan.js";
import { generateLoanNumber } from "../utils/generateLoanNumber.js";

test("Pawn loan snapshot MongoDB integration", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  // Never use the application database for this test.
  const testDbName =
    `sigiri_snapshot_test_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(mongoUri);
  testUri.pathname = `/${testDbName}`;

  // Fail safely if the URI cannot target the isolated DB.
  assert.equal(
    new URL(testUri.toString()).pathname,
    `/${testDbName}`
  );

  let connected = false;

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const session = await mongoose.startSession();

    let loanId;
    let originalSettingsVersion;

    try {
      await session.withTransaction(async () => {
        const [settings] = await LoanSettings.create(
          [
            {
              settingsKey: "default",
              interest: {
                rate: 2,
                calculationMethod: "monthly",
              },
              loan: {
                defaultDurationMonths: 6,
              },
              partialPayment: {
                enabled: true,
                allowPartialInterest: true,
                allowPartialPrincipal: false,
                allocationMethod: "interest_first",
                minimumAmount: 500,
              },
            },
          ],
          { session }
        );

        originalSettingsVersion = settings.version;

        const loanNumber = await generateLoanNumber(session);

        assert.match(
          loanNumber,
          /^SIG-\d{4}-000001$/
        );

        const [loan] = await PawnLoan.create(
          [
            {
              loanNumber,
              customer: new mongoose.Types.ObjectId(),
              goldItems: [new mongoose.Types.ObjectId()],
              principalAmount: 100000,
              interestRate: settings.interest.rate,
              issueDate: new Date("2026-11-01"),
              maturityDate: new Date("2027-05-01"),
              settingsVersion: settings.version,
              settingsSnapshot: {
                interest: settings.interest.toObject(),
                loan: settings.loan.toObject(),
                partialPayment:
                  settings.partialPayment.toObject(),
                renewal: settings.renewal.toObject(),
                overdue: settings.overdue.toObject(),
              },
              createdBy: new mongoose.Types.ObjectId(),
            },
          ],
          { session }
        );

        loanId = loan._id;
      });
    } finally {
      await session.endSession();
    }

    const savedLoan = await PawnLoan.findById(loanId);

    assert.ok(savedLoan);
    assert.equal(savedLoan.settingsVersion, originalSettingsVersion);

    assert.equal(
      savedLoan.settingsSnapshot.partialPayment.allowPartialInterest,
      true
    );

    assert.equal(
      savedLoan.settingsSnapshot.partialPayment.allowPartialPrincipal,
      false
    );

    console.log("Loan number generated: PASSED");
    console.log("Loan snapshot saved to MongoDB: PASSED");
    console.log("Partial payment fields preserved: PASSED");

    // Simulate an Admin Settings change.
    await LoanSettings.updateOne(
      { settingsKey: "default" },
      {
        $set: {
          "partialPayment.allowPartialInterest": false,
          "partialPayment.allowPartialPrincipal": true,
        },
        $inc: { version: 1 },
      }
    );

    const loanAfterSettingsChange =
      await PawnLoan.findById(loanId);

    assert.equal(
      loanAfterSettingsChange.settingsSnapshot.partialPayment
        .allowPartialInterest,
      true
    );

    assert.equal(
      loanAfterSettingsChange.settingsSnapshot.partialPayment
        .allowPartialPrincipal,
      false
    );

    assert.equal(
      loanAfterSettingsChange.settingsVersion,
      originalSettingsVersion
    );

    console.log("Old loan snapshot remains unchanged: PASSED");
  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
