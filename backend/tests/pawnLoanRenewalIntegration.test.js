
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";

import {
  renewPawnLoan,
} from "../controllers/pawnLoanRenewalController.js";

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

test("Pawn loan renewal API integration", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_renewal_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(mongoUri);
  testUri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const userId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    const goldItemId = new mongoose.Types.ObjectId();

    const createLoan = async ({
      loanNumber,
      status = "active",
      renewalEnabled = true,
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
          renewal: {
            enabled: renewalEnabled,
            durationMonths: 6,
            requireInterestSettlement: true,
            renewalFee: 0,
          },
        },
        createdBy: userId,
      });
    };

    const requestRenewal = async ({
      loanId,
      body,
      user = {
        _id: userId,
        role: "admin",
        isActive: true,
      },
    }) => {
      const response = createResponse();

      await renewPawnLoan(
        {
          params: { id: String(loanId) },
          body,
          user,
        },
        response
      );

      return response;
    };

    const validBody = {
      idempotencyKey: "renewal_test_key_123456",
      notes: "Customer requested renewal",
    };

    // 1. Invalid request
    const invalidResponse = await requestRenewal({
      loanId: "invalid-id",
      body: validBody,
    });

    assert.equal(invalidResponse.statusCode, 400);

    // 2. Unknown loan
    const unknownResponse = await requestRenewal({
      loanId: new mongoose.Types.ObjectId(),
      body: validBody,
    });

    assert.equal(unknownResponse.statusCode, 404);

    // 3. Draft loan cannot be renewed
    const draftLoan = await createLoan({
      loanNumber: "SIG-RENEW-000001",
      status: "draft",
    });

    const draftResponse = await requestRenewal({
      loanId: draftLoan._id,
      body: validBody,
    });

    assert.equal(draftResponse.statusCode, 409);
    assert.equal(
      draftResponse.body.code,
      "RENEWAL_NOT_ELIGIBLE"
    );

    // 4. Renewal disabled in loan snapshot
    const disabledLoan = await createLoan({
      loanNumber: "SIG-RENEW-000002",
      renewalEnabled: false,
    });

    const disabledResponse = await requestRenewal({
      loanId: disabledLoan._id,
      body: validBody,
    });

    assert.equal(disabledResponse.statusCode, 409);

    // 5. Eligible loan must return 501
    const activeLoan = await createLoan({
      loanNumber: "SIG-RENEW-000003",
    });

    const originalMaturityDate =
      activeLoan.maturityDate.getTime();

    const originalPrincipal =
      activeLoan.principalAmount;

    const activeResponse = await requestRenewal({
      loanId: activeLoan._id,
      body: validBody,
    });

    assert.equal(
      activeResponse.statusCode,
      501,
      JSON.stringify(activeResponse.body)
    );

    assert.equal(
      activeResponse.body.code,
      "RENEWAL_POSTING_DISABLED"
    );

    // 6. Verify loan financial data is unchanged
    const loanAfterRequest = await PawnLoan.findById(
      activeLoan._id
    );

    assert.equal(
      loanAfterRequest.maturityDate.getTime(),
      originalMaturityDate
    );

    assert.equal(
      loanAfterRequest.principalAmount,
      originalPrincipal
    );

    // 7. Verify no renewal record was created
    const renewalCount =
      await PawnLoanRenewal.countDocuments({
        pawnLoan: activeLoan._id,
      });

    assert.equal(renewalCount, 0);

    // 8. Unauthorized user
    const unauthorizedResponse = await requestRenewal({
      loanId: activeLoan._id,
      body: validBody,
      user: null,
    });

    assert.equal(unauthorizedResponse.statusCode, 401);

    // 9. Inactive user
    const inactiveResponse = await requestRenewal({
      loanId: activeLoan._id,
      body: validBody,
      user: {
        _id: userId,
        role: "staff",
        isActive: false,
      },
    });

    assert.equal(inactiveResponse.statusCode, 403);

    // 10. Unexpected request fields
    const extraFieldResponse = await requestRenewal({
      loanId: activeLoan._id,
      body: {
        ...validBody,
        newMaturityDate: "2028-01-01",
      },
    });

    assert.equal(extraFieldResponse.statusCode, 400);

  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
