
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";

import {
  getOverduePawnLoans,
} from "../controllers/pawnLoanOverdueController.js";

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

test("Pawn loan overdue MongoDB integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const uri = new URL(process.env.MONGO_URI);

  const dbName =
    `sigiri_overdue_test_${randomUUID().replaceAll("-", "")}`;

  uri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    await PawnLoan.init();

    const userId = newId();
    const customerId = newId();

    // Use dates safely in the past so the test
    // does not depend on the current calendar day.
    const daysAgo = (days) =>
      new Date(Date.now() - days * 86400000);

    const createLoan = async ({
      loanNumber,
      maturityDaysAgo,
      gracePeriodDays,
      status = "active",
      includeOverdueSettings = true,
    }) => {
      const overdueSettings = includeOverdueSettings
        ? { gracePeriodDays }
        : {};

      return PawnLoan.create({
        loanNumber,
        customer: customerId,
        goldItems: [newId()],
        principalAmount: 100000,
        interestRate: 2,
        issueDate: daysAgo(180),
        maturityDate: daysAgo(maturityDaysAgo),
        status,
        settingsVersion: 1,
        settingsSnapshot: {
          interest: {
            rate: 2,
            calculationMethod: "monthly",
            principalCalculationMethod:
              "original_principal",
            minimumInterestDays: 0,
            chargeFullFirstMonth: false,
          },
          loan: {
            defaultDurationMonths: 6,
          },
          overdue: overdueSettings,
        },
        createdBy: userId,
      });
    };

    const overdueA = await createLoan({
      loanNumber: "SIG-OVERDUE-000001",
      maturityDaysAgo: 20,
      gracePeriodDays: 5,
    });

    const overdueB = await createLoan({
      loanNumber: "SIG-OVERDUE-000002",
      maturityDaysAgo: 10,
      gracePeriodDays: 3,
    });

    await createLoan({
      loanNumber: "SIG-OVERDUE-000003",
      maturityDaysAgo: 2,
      gracePeriodDays: 5,
    });

    await createLoan({
      loanNumber: "SIG-OVERDUE-000004",
      maturityDaysAgo: 20,
      gracePeriodDays: 0,
      status: "redeemed",
    });

    await createLoan({
      loanNumber: "SIG-OVERDUE-000005",
      maturityDaysAgo: 30,
      gracePeriodDays: undefined,
      includeOverdueSettings: false,
    });

    const requestOverdue = async ({
      query = {},
      role = "admin",
      isActive = true,
      user = true,
    } = {}) => {
      const response = createResponse();

      await getOverduePawnLoans(
        {
          query,
          user: user
            ? {
                _id: userId,
                role,
                isActive,
              }
            : undefined,
        },
        response
      );

      return response;
    };

    // 1. Admin can retrieve overdue loans
    const adminResponse = await requestOverdue();

    assert.equal(adminResponse.statusCode, 200);
    assert.equal(adminResponse.body.success, true);
    assert.equal(adminResponse.body.pagination.total, 2);
    assert.equal(adminResponse.body.count, 2);

    assert.deepEqual(
      adminResponse.body.pawnLoans.map(
        (loan) => loan.loanNumber
      ),
      [
        "SIG-OVERDUE-000001",
        "SIG-OVERDUE-000002",
      ]
    );

    // 2. Staff can retrieve overdue loans
    const staffResponse = await requestOverdue({
      role: "staff",
    });

    assert.equal(staffResponse.statusCode, 200);
    assert.equal(staffResponse.body.pagination.total, 2);

    // 3. Grace-period loans are excluded
    const loanNumbers =
      adminResponse.body.pawnLoans.map(
        (loan) => loan.loanNumber
      );

    assert.equal(
      loanNumbers.includes("SIG-OVERDUE-000003"),
      false
    );

    // 4. Redeemed loans are excluded
    assert.equal(
      loanNumbers.includes("SIG-OVERDUE-000004"),
      false
    );

    // 5. Missing settings reported separately
    assert.equal(
      adminResponse.body.dataQuality.invalidSettingsCount,
      1
    );

    assert.equal(
      adminResponse.body.dataQuality
        .loansWithInvalidSettings[0].loanNumber,
      "SIG-OVERDUE-000005"
    );

    // 6. Pagination
    const firstPage = await requestOverdue({
      query: { page: "1", limit: "1" },
    });

    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.count, 1);
    assert.equal(firstPage.body.pagination.total, 2);
    assert.equal(firstPage.body.pagination.totalPages, 2);

    assert.equal(
      firstPage.body.pawnLoans[0].loanNumber,
      "SIG-OVERDUE-000001"
    );

    const secondPage = await requestOverdue({
      query: { page: "2", limit: "1" },
    });

    assert.equal(secondPage.statusCode, 200);
    assert.equal(
      secondPage.body.pawnLoans[0].loanNumber,
      "SIG-OVERDUE-000002"
    );

    // 7. Invalid pagination rejected
    for (const query of [
      { page: "0" },
      { page: "-1" },
      { page: "abc" },
      { limit: "0" },
      { limit: "101" },
      { limit: "1.5" },
      { unexpected: "value" },
    ]) {
      const response = await requestOverdue({ query });

      assert.equal(response.statusCode, 400);
    }

    // 8. Unauthorized role rejected
    const invalidRole = await requestOverdue({
      role: "unknown",
    });

    assert.equal(invalidRole.statusCode, 403);

    // 9. Inactive user rejected
    const inactiveUser = await requestOverdue({
      isActive: false,
    });

    assert.equal(inactiveUser.statusCode, 403);

    // 10. Missing user rejected
    const missingUser = await requestOverdue({
      user: false,
    });

    assert.equal(missingUser.statusCode, 401);

    // 11. Read-only verification
    const loanAfterA = await PawnLoan.findById(overdueA._id);
    const loanAfterB = await PawnLoan.findById(overdueB._id);

    assert.equal(loanAfterA.status, "active");
    assert.equal(loanAfterB.status, "active");

    assert.equal(loanAfterA.principalAmount, 100000);
    assert.equal(loanAfterB.principalAmount, 100000);

    assert.equal(
      await PawnLoan.countDocuments(),
      5
    );

    console.log(
      "Overdue loan MongoDB integration: PASSED"
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
