
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import Customer from "../models/Customer.js";
import GoldItem from "../models/GoldItem.js";
import PawnLoan from "../models/PawnLoan.js";
import LoanSettings from "../models/LoanSettings.js";
import AuditLog from "../models/AuditLog.js";

import {
  createPawnLoan,
  activatePawnLoan,
} from "../controllers/pawnLoanController.js";

test("Pawn loan creation and activation preserves original settings", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  // Use an isolated test database.
  const testDbName =
    `sigiri_lifecycle_test_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(mongoUri);
  testUri.pathname = `/${testDbName}`;

  let connected = false;

  const createResponse = () => ({
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  });

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const adminId = new mongoose.Types.ObjectId();

    const customer = await Customer.create({
      customerCode: "TEST-CUST-001",
      fullName: "Integration Test Customer",
      nic: "900000001V",
      phone: "0771234567",
      address: "Test Address",
      status: "active",
    });

    const goldItem = await GoldItem.create({
      itemType: "Ring",
      description: "Integration test gold ring",
      karat: "22K",
      grossWeight: 10,
      deductionWeight: 0.5,
      netWeight: 9.5,
      status: "draft",
      createdBy: adminId,
    });

    await LoanSettings.create({
      settingsKey: "default",
     
interest: {
  rate: 2,
  calculationMethod: "monthly",
  principalCalculationMethod: "original_principal",
  minimumInterestDays: 0,
  chargeFullFirstMonth: false,
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
    });

    const user = {
      _id: adminId,
      role: "admin",
      isActive: true,
    };

    const requestInfo = {
      user,
      ip: "127.0.0.1",
      get: () => "Sigiri Lifecycle Integration Test",
    };

    // 1. Create draft loan through controller.
    const createResponseObject = createResponse();

    await createPawnLoan(
      {
        ...requestInfo,
        body: {
          customerId: String(customer._id),
          goldItemIds: [String(goldItem._id)],
          principalAmount: 100000,
        },
      },
      createResponseObject
    );

    assert.equal(
      createResponseObject.statusCode,
      201,
      JSON.stringify(createResponseObject.body)
    );

    const loanId = createResponseObject.body.pawnLoan._id;

    const draftLoan = await PawnLoan.findById(loanId);

    assert.equal(draftLoan.status, "draft");
    assert.equal(draftLoan.settingsVersion, 1);
    assert.equal(draftLoan.interestRate, 2);

    assert.equal(
      draftLoan.settingsSnapshot.partialPayment
        .allowPartialInterest,
      true
    );

    assert.equal(
      draftLoan.settingsSnapshot.partialPayment
        .allowPartialPrincipal,
      false
    );

    const reservedItem = await GoldItem.findById(
      goldItem._id
    );

    assert.equal(reservedItem.status, "draft");
    assert.equal(
      String(reservedItem.reservedForLoan),
      String(loanId)
    );

    console.log("Draft loan created and gold reserved: PASSED");
    console.log("Original settings snapshot saved: PASSED");

    // 2. Simulate Admin changing the current settings.
    await LoanSettings.updateOne(
      { settingsKey: "default" },
      {
        $set: {
          "interest.rate": 3,
          "partialPayment.allowPartialInterest": false,
          "partialPayment.allowPartialPrincipal": true,
        },
        $inc: { version: 1 },
      }
    );

    // 3. Activate the existing draft loan.
    const activateResponseObject = createResponse();

    await activatePawnLoan(
      {
        ...requestInfo,
        params: {
          id: String(loanId),
        },
      },
      activateResponseObject
    );

    assert.equal(
      activateResponseObject.statusCode,
      200,
      JSON.stringify(activateResponseObject.body)
    );

    const activeLoan = await PawnLoan.findById(loanId);

    assert.equal(activeLoan.status, "active");
    assert.ok(activeLoan.activatedAt);

    // Option A: Preserve settings from draft creation.
    assert.equal(activeLoan.settingsVersion, 1);
    assert.equal(activeLoan.interestRate, 2);

    assert.equal(
      activeLoan.settingsSnapshot.interest.rate,
      2
    );

    assert.equal(
      activeLoan.settingsSnapshot.partialPayment
        .allowPartialInterest,
      true
    );

    assert.equal(
      activeLoan.settingsSnapshot.partialPayment
        .allowPartialPrincipal,
      false
    );

    const pledgedItem = await GoldItem.findById(
      goldItem._id
    );

    assert.equal(pledgedItem.status, "pledged");
    assert.equal(
      String(pledgedItem.reservedForLoan),
      String(loanId)
    );

    console.log("Loan activation: PASSED");
    console.log("Original snapshot preserved after activation: PASSED");
    console.log("Gold item pledged: PASSED");

    // 4. Verify audit logs.
    const creationAudit = await AuditLog.findOne({
      action: "PAWN_LOAN_CREATED",
      targetId: loanId,
    });

    const activationAudit = await AuditLog.findOne({
      action: "PAWN_LOAN_ACTIVATED",
      targetId: loanId,
    });

    assert.ok(creationAudit);
    assert.ok(activationAudit);

    console.log("Creation and activation audit logs: PASSED");

    // 5. Attempt to create another loan
    // using the already pledged gold item.
    const duplicateResponse = createResponse();

    await createPawnLoan(
      {
        ...requestInfo,
        body: {
          customerId: String(customer._id),
          goldItemIds: [String(goldItem._id)],
          principalAmount: 50000,
        },
      },
      duplicateResponse
    );

    assert.equal(
      duplicateResponse.statusCode,
      409,
      JSON.stringify(duplicateResponse.body)
    );

    // The failed transaction must not create another loan.
    const loanCount = await PawnLoan.countDocuments();

    assert.equal(loanCount, 1);

    // Original loan reservation must remain intact.
    const goldAfterDuplicateAttempt =
      await GoldItem.findById(goldItem._id);

    assert.equal(goldAfterDuplicateAttempt.status, "pledged");

    assert.equal(
      String(goldAfterDuplicateAttempt.reservedForLoan),
      String(loanId)
    );

    // Failed creation must not produce a creation audit log.
    const creationAuditCount = await AuditLog.countDocuments({
      action: "PAWN_LOAN_CREATED",
    });

    assert.equal(creationAuditCount, 1);

    console.log("Duplicate gold reservation blocked: PASSED");
    console.log("Failed loan transaction rolled back: PASSED");
    console.log("Original gold reservation protected: PASSED");


  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
