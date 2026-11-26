
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

import { createPawnLoan } from "../controllers/pawnLoanController.js";

test("Concurrent loan creation cannot reserve the same gold item twice", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  const testDbName =
    `sigiri_concurrency_test_${randomUUID().replaceAll("-", "")}`;

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

    const cashierId = new mongoose.Types.ObjectId();

    const customer = await Customer.create({
      customerCode: "TEST-CONCURRENT-001",
      fullName: "Concurrent Test Customer",
      nic: "900000002V",
      phone: "0771234567",
      address: "Test Address",
      status: "active",
    });

    const goldItem = await GoldItem.create({
      itemType: "Ring",
      karat: "22K",
      grossWeight: 10,
      deductionWeight: 0,
      netWeight: 10,
      createdBy: cashierId,
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
    });

    const makeRequest = () => ({
      user: {
        _id: cashierId,
        role: "staff",
        isActive: true,
      },
      ip: "127.0.0.1",
      get: () => "Concurrency Test",
      body: {
        customerId: String(customer._id),
        goldItemIds: [String(goldItem._id)],
        principalAmount: 100000,
      },
    });

    const responseA = createResponse();
    const responseB = createResponse();

    // Simulate two simultaneous cashier requests.
    await Promise.all([
      createPawnLoan(makeRequest(), responseA),
      createPawnLoan(makeRequest(), responseB),
    ]);

    const statusCodes = [
      responseA.statusCode,
      responseB.statusCode,
    ].sort((a, b) => a - b);

    assert.deepEqual(statusCodes, [201, 409]);

    const loans = await PawnLoan.find();

    assert.equal(loans.length, 1);

    const itemAfter = await GoldItem.findById(goldItem._id);

    assert.equal(
      String(itemAfter.reservedForLoan),
      String(loans[0]._id)
    );

    const auditCount = await AuditLog.countDocuments({
      action: "PAWN_LOAN_CREATED",
    });

    assert.equal(auditCount, 1);

    console.log("Only one concurrent loan succeeded: PASSED");
    console.log("Duplicate reservation prevented: PASSED");
    console.log("Only one creation audit log: PASSED");
  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
