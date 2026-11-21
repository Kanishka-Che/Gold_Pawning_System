
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

test("Pawn loan preserves partial payment settings snapshot", () => {
  const loan = new PawnLoan({
    loanNumber: "TEST-SNAPSHOT-001",
    customer: new mongoose.Types.ObjectId(),
    goldItems: [new mongoose.Types.ObjectId()],
    principalAmount: 100000,
    interestRate: 2,
    issueDate: new Date("2026-11-01"),
    maturityDate: new Date("2027-05-01"),
    settingsVersion: 3,
    createdBy: new mongoose.Types.ObjectId(),

    settingsSnapshot: {
      partialPayment: {
        enabled: true,
        allowPartialInterest: true,
        allowPartialPrincipal: false,
        allocationMethod: "interest_first",
        minimumAmount: 500,
      },
    },
  });

  const savedDocument = loan.toObject();

  assert.equal(savedDocument.settingsVersion, 3);

  assert.equal(
    savedDocument.settingsSnapshot.partialPayment
      .allowPartialInterest,
    true
  );

  assert.equal(
    savedDocument.settingsSnapshot.partialPayment
      .allowPartialPrincipal,
    false
  );

  assert.equal(
    savedDocument.settingsSnapshot.partialPayment
      .allocationMethod,
    "interest_first"
  );

  console.log("Partial payment snapshot fields: PASSED");
  console.log("Settings version preserved: PASSED");
});
