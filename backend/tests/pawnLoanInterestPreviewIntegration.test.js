
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import {
  getPawnLoanInterestPreview,
} from "../controllers/pawnLoanController.js";

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

test("Pawn loan interest preview integration", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_interest_preview_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(mongoUri);
  testUri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const userId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    const goldItemId = new mongoose.Types.ObjectId();

    const baseSettings = {
      rate: 2,
      calculationMethod: "monthly",
      principalCalculationMethod: "original_principal",
      minimumInterestDays: 0,
      chargeFullFirstMonth: false,
    };

    const createLoan = async ({
      loanNumber,
      status,
      interestSettings,
    }) => {
      return PawnLoan.create({
        loanNumber,
        customer: customerId,
        goldItems: [goldItemId],
        principalAmount: 100000,
        interestRate: 2,
        issueDate: new Date("2026-11-01T00:00:00Z"),
        maturityDate: new Date("2027-05-01T00:00:00Z"),
        status,
        settingsVersion: 1,
        settingsSnapshot: {
          interest: interestSettings,
          loan: {
            defaultDurationMonths: 6,
          },
        },
        createdBy: userId,
      });
    };

    const preview = async (loanId) => {
      const response = createResponse();

      await getPawnLoanInterestPreview(
        {
          params: { id: String(loanId) },
        },
        response
      );

      return response;
    };

    // 1. Supported interest settings
    const supportedLoan = await createLoan({
      loanNumber: "SIG-TEST-000001",
      status: "active",
      interestSettings: baseSettings,
    });

    const supportedResponse = await preview(
      supportedLoan._id
    );

    assert.equal(
      supportedResponse.statusCode,
      200,
      JSON.stringify(supportedResponse.body)
    );

    assert.equal(
      supportedResponse.body.preview.principalAmount,
      100000
    );

    assert.equal(
      supportedResponse.body.preview.calculationMethod,
      "monthly"
    );

    assert.equal(
      supportedResponse.body.preview.isFinalSettlementAmount,
      false
    );

    console.log("Supported interest preview: PASSED");

    // 2. Unconfirmed principal calculation method
    const unconfirmedLoan = await createLoan({
      loanNumber: "SIG-TEST-000002",
      status: "active",
      interestSettings: {
        ...baseSettings,
        principalCalculationMethod: undefined,
      },
    });

    const unconfirmedResponse = await preview(
      unconfirmedLoan._id
    );

    assert.equal(unconfirmedResponse.statusCode, 409);
    assert.equal(
      unconfirmedResponse.body.code,
      "INTEREST_RULE_NOT_SUPPORTED"
    );

    console.log("Unconfirmed principal method blocked: PASSED");

    // 3. Unsupported minimum interest days
    const unsupportedLoan = await createLoan({
      loanNumber: "SIG-TEST-000003",
      status: "active",
      interestSettings: {
        ...baseSettings,
        minimumInterestDays: 10,
      },
    });

    const unsupportedResponse = await preview(
      unsupportedLoan._id
    );

    assert.equal(unsupportedResponse.statusCode, 409);
    assert.equal(
      unsupportedResponse.body.code,
      "INTEREST_RULE_NOT_SUPPORTED"
    );

    console.log("Unsupported interest rule blocked: PASSED");

    // 4. Draft loan preview must be blocked
    const draftLoan = await createLoan({
      loanNumber: "SIG-TEST-000004",
      status: "draft",
      interestSettings: baseSettings,
    });

    const draftResponse = await preview(draftLoan._id);

    assert.equal(draftResponse.statusCode, 409);

    console.log("Draft loan interest preview blocked: PASSED");


    // 5. Remaining principal + daily interest preview
    const dailySettings = {
      ...baseSettings,
      calculationMethod: "daily",
      principalCalculationMethod: "remaining_principal",
    };

    const dailyLoan = await createLoan({
      loanNumber: "SIG-TEST-000005",
      status: "active",
      interestSettings: dailySettings,
    });

    const paymentDate = new Date("2026-11-10T06:00:00Z");

    await PawnPayment.create({
      pawnLoan: dailyLoan._id,
      idempotencyKey: randomUUID(),
      amount: 21000,
      interestPaid: 1000,
      principalPaid: 20000,
      paymentMethod: "cash",
      paidAt: paymentDate,
      recordedBy: userId,
      reference: "Integration test payment",
    });

    const dailyResponse = await preview(dailyLoan._id);

    assert.equal(
      dailyResponse.statusCode,
      200,
      JSON.stringify(dailyResponse.body)
    );

    const dailyPreview = dailyResponse.body.preview;

    assert.equal(
      dailyPreview.calculationMethod,
      "daily"
    );

    assert.equal(
      dailyPreview.principalCalculationMethod,
      "remaining_principal"
    );

    assert.equal(
      dailyPreview.originalPrincipal,
      "100000.00"
    );

    assert.equal(
      dailyPreview.outstandingPrincipal,
      "80000.00"
    );

    assert.equal(
      dailyPreview.totalInterestPaid,
      "1000.00"
    );

    assert.equal(
      dailyPreview.isFinalSettlementAmount,
      false
    );

    assert.equal(
      dailyPreview.periods.length,
      2
    );

    console.log(
      "Remaining principal daily preview integration: PASSED"
    );

    // 6. Monthly remaining principal must remain blocked
    const unsupportedMonthlyLoan = await createLoan({
      loanNumber: "SIG-TEST-000006",
      status: "active",
      interestSettings: {
        ...baseSettings,
        calculationMethod: "monthly",
        principalCalculationMethod: "remaining_principal",
      },
    });

    const unsupportedMonthlyResponse = await preview(
      unsupportedMonthlyLoan._id
    );

    assert.equal(
      unsupportedMonthlyResponse.statusCode,
      409
    );

    assert.equal(
      unsupportedMonthlyResponse.body.code,
      "INTEREST_RULE_NOT_SUPPORTED"
    );

    console.log(
      "Monthly remaining principal blocked: PASSED"
    );


  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
