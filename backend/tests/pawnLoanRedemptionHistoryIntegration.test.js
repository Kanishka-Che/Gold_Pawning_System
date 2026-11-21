
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  getPawnLoanRedemptionHistory,
} from "../controllers/pawnLoanRedemptionController.js";

const newId = () => new mongoose.Types.ObjectId();

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

test("Pawn loan redemption history MongoDB integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_redemption_history_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    await PawnLoan.init();
    await PawnLoanRedemption.init();

    const userId = newId();
    const customerId = newId();

    const createLoan = async (loanNumber) => {
      return PawnLoan.create({
        loanNumber,
        customer: customerId,
        goldItems: [newId()],
        principalAmount: 100000,
        interestRate: 2,
        issueDate: new Date("2026-11-01T00:00:00Z"),
        maturityDate: new Date("2027-05-01T00:00:00Z"),
        status: "active",
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
        },
        createdBy: userId,
      });
    };

    const loanA = await createLoan("SIG-HISTORY-000001");
    const loanB = await createLoan("SIG-HISTORY-000002");

    const requestHistory = async ({
      loanId = loanA._id,
      query = {},
    } = {}) => {
      const response = createResponse();

      await getPawnLoanRedemptionHistory(
        {
          params: { id: String(loanId) },
          query,
          user: {
            _id: userId,
            role: "admin",
            isActive: true,
          },
        },
        response
      );

      return response;
    };

    // 1. Empty redemption history
    const emptyResponse = await requestHistory();

    assert.equal(emptyResponse.statusCode, 200);
    assert.equal(emptyResponse.body.success, true);
    assert.equal(emptyResponse.body.count, 0);
    assert.equal(emptyResponse.body.redemptions.length, 0);
    assert.equal(emptyResponse.body.pagination.total, 0);

    // Historical test fixture only.
    // This does not enable redemption posting.
    await PawnLoanRedemption.create({
      pawnLoan: loanA._id,
      idempotencyKey: randomUUID(),
      redeemedAt: new Date("2026-11-10T10:00:00Z"),
      redeemedBy: userId,
      settingsVersion: 1,
      principalSettled: 100000,
      interestSettled: 2000,
      penaltySettled: 0,
      totalSettled: 102000,
      releasedGoldItems: [loanA.goldItems[0]],
      notes: "Historical redemption fixture",
    });

    await PawnLoanRedemption.create({
      pawnLoan: loanB._id,
      idempotencyKey: randomUUID(),
      redeemedAt: new Date("2026-11-11T10:00:00Z"),
      redeemedBy: userId,
      settingsVersion: 1,
      principalSettled: 100000,
      interestSettled: 1000,
      penaltySettled: 0,
      totalSettled: 101000,
      releasedGoldItems: [loanB.goldItems[0]],
      notes: "Other loan redemption fixture",
    });

    // 2. Existing redemption history
    const historyResponse = await requestHistory();

    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.body.count, 1);
    assert.equal(historyResponse.body.pagination.total, 1);

    assert.equal(
      historyResponse.body.redemptions[0].totalSettled,
      102000
    );

    assert.equal(
      String(historyResponse.body.redemptions[0].pawnLoan),
      String(loanA._id)
    );

    // 3. Pagination: first page
    const firstPage = await requestHistory({
      query: { page: "1", limit: "1" },
    });

    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.count, 1);
    assert.equal(firstPage.body.pagination.totalPages, 1);

    // 4. Pagination: second page
    const secondPage = await requestHistory({
      query: { page: "2", limit: "1" },
    });

    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.body.count, 0);
    assert.equal(secondPage.body.pagination.total, 1);

    // 5. Other loan's history is isolated
    const otherLoanResponse = await requestHistory({
      loanId: loanB._id,
    });

    assert.equal(otherLoanResponse.statusCode, 200);
    assert.equal(otherLoanResponse.body.count, 1);

    assert.equal(
      otherLoanResponse.body.redemptions[0].totalSettled,
      101000
    );

    // 6. History reads must not change the loan
    const loanAfter = await PawnLoan.findById(loanA._id);

    assert.equal(loanAfter.status, "active");
    assert.equal(loanAfter.principalAmount, 100000);

    // 7. No additional redemption records
    const redemptionCount =
      await PawnLoanRedemption.countDocuments();

    assert.equal(redemptionCount, 2);

    console.log(
      "Redemption history MongoDB integration: PASSED"
    );
  } finally {
    if (connected) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  }
});
