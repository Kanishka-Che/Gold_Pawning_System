
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";

import {
  getPawnLoanRenewalHistory,
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

test("Pawn loan renewal history API integration", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_renewal_history_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(mongoUri);
  testUri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const userId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    const goldItemId = new mongoose.Types.ObjectId();

    const loan = await PawnLoan.create({
      loanNumber: "SIG-RENEW-HISTORY-001",
      customer: customerId,
      goldItems: [goldItemId],
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
        renewal: {
          enabled: true,
          durationMonths: 6,
          requireInterestSettlement: true,
          renewalFee: 0,
        },
      },
      createdBy: userId,
    });

    
const requestHistory = async ({
  loanId = String(loan._id),
  user = {
    _id: userId,
    role: "admin",
    isActive: true,
  },
  query = {},
} = {}) => {
  const response = createResponse();

  await getPawnLoanRenewalHistory(
    {
      params: { id: String(loanId) },
      user,
      query,
    },
    response
  );

  return response;
};


    // 1. Empty renewal history
    const emptyResponse = await requestHistory();

    assert.equal(emptyResponse.statusCode, 200);
    assert.equal(emptyResponse.body.success, true);
    assert.equal(emptyResponse.body.count, 0);
    assert.deepEqual(emptyResponse.body.renewals, []);

    // 2. Insert historical test records directly.
    // This is test fixture setup, NOT API renewal posting.
    await PawnLoanRenewal.create([
      {
        pawnLoan: loan._id,
        idempotencyKey: "renewal_history_test_key_001",
        previousMaturityDate: new Date("2027-05-01"),
        newMaturityDate: new Date("2027-11-01"),
        renewedAt: new Date("2027-05-01"),
        renewedBy: userId,
        settingsVersion: 1,
        interestSettled: 3000,
        renewalFeePaid: 0,
        notes: "First renewal",
      },
      {
        pawnLoan: loan._id,
        idempotencyKey: "renewal_history_test_key_002",
        previousMaturityDate: new Date("2027-11-01"),
        newMaturityDate: new Date("2028-05-01"),
        renewedAt: new Date("2027-11-01"),
        renewedBy: userId,
        settingsVersion: 1,
        interestSettled: 3500,
        renewalFeePaid: 0,
        notes: "Second renewal",
      },
    ]);

    // 3. Read existing renewal history
    const historyResponse = await requestHistory();

    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.body.count, 2);
    assert.equal(historyResponse.body.renewals.length, 2);

    // Latest renewal first
    assert.equal(
      historyResponse.body.renewals[0].notes,
      "Second renewal"
    );

    assert.equal(
      historyResponse.body.renewals[1].notes,
      "First renewal"
    );

    // Internal idempotency key must not be exposed
    assert.equal(
      historyResponse.body.renewals[0].idempotencyKey,
      undefined
    );


// Pagination: default values
assert.deepEqual(historyResponse.body.pagination, {
  page: 1,
  limit: 20,
  total: 2,
  totalPages: 1,
});

// Pagination: first page
const firstPage = await requestHistory({
  query: { page: "1", limit: "1" },
});

assert.equal(firstPage.statusCode, 200);
assert.equal(firstPage.body.count, 1);
assert.equal(firstPage.body.pagination.total, 2);
assert.equal(firstPage.body.pagination.totalPages, 2);
assert.equal(firstPage.body.renewals[0].notes, "Second renewal");

// Pagination: second page
const secondPage = await requestHistory({
  query: { page: "2", limit: "1" },
});

assert.equal(secondPage.statusCode, 200);
assert.equal(secondPage.body.count, 1);
assert.equal(secondPage.body.renewals[0].notes, "First renewal");

// Pagination: page beyond available records
const emptyPage = await requestHistory({
  query: { page: "3", limit: "1" },
});

assert.equal(emptyPage.statusCode, 200);
assert.equal(emptyPage.body.count, 0);
assert.deepEqual(emptyPage.body.renewals, []);

// Reject invalid pagination
for (const query of [
  { page: "0" },
  { page: "-1" },
  { page: "abc" },
  { page: "1.5" },
  { limit: "0" },
  { limit: "101" },
  { limit: "abc" },
  { page: "999999999999999999999" },
  { unexpected: "value" },
]) {
  const response = await requestHistory({ query });

  assert.equal(
    response.statusCode,
    400,
    `Expected 400 for ${JSON.stringify(query)}`
  );
}

// Maximum allowed limit
const maxLimitResponse = await requestHistory({
  query: { page: "1", limit: "100" },
});

assert.equal(maxLimitResponse.statusCode, 200);
assert.equal(maxLimitResponse.body.pagination.limit, 100);

// Confirm idempotency keys remain hidden
for (const renewal of firstPage.body.renewals) {
  assert.equal(renewal.idempotencyKey, undefined);
}



    // 4. Invalid loan ID
    const invalidResponse = await requestHistory({
      loanId: "invalid-id",
    });

    assert.equal(invalidResponse.statusCode, 400);

    // 5. Unknown loan
    const unknownResponse = await requestHistory({
      loanId: new mongoose.Types.ObjectId(),
    });

    assert.equal(unknownResponse.statusCode, 404);

    // 6. Missing user
    const unauthorizedResponse = await requestHistory({
      user: null,
    });

    assert.equal(unauthorizedResponse.statusCode, 401);

    // 7. Inactive user
    const inactiveResponse = await requestHistory({
      user: {
        _id: userId,
        role: "staff",
        isActive: false,
      },
    });

    assert.equal(inactiveResponse.statusCode, 403);

    // 8. Confirm financial loan data is unchanged
    const loanAfterHistory = await PawnLoan.findById(
      loan._id
    );

    assert.equal(
      loanAfterHistory.principalAmount,
      100000
    );

    assert.equal(
      loanAfterHistory.maturityDate.toISOString(),
      "2027-05-01T00:00:00.000Z"
    );

  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
