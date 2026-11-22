
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import PawnLoanRenewal from "../models/PawnLoanRenewal.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

import {
  getPawnLoanTransactionHistory,
} from "../controllers/pawnLoanTransactionHistoryController.js";

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

test("Pawn loan combined transaction history integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_transaction_history_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(process.env.MONGO_URI);
  testUri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const userId = new mongoose.Types.ObjectId();

    const loan = await PawnLoan.create({
      loanNumber: "SIG-TRANSACTION-HISTORY-001",
      customer: new mongoose.Types.ObjectId(),
      goldItems: [new mongoose.Types.ObjectId()],
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

      await getPawnLoanTransactionHistory(
        {
          params: { id: String(loanId) },
          user,
          query,
        },
        response
      );

      return response;
    };

    // Empty history
    const empty = await requestHistory();

    assert.equal(empty.statusCode, 200);
    assert.equal(empty.body.count, 0);
    assert.equal(empty.body.pagination.total, 0);

    // Test fixtures only. Financial posting APIs remain disabled.
    await PawnPayment.create({
      pawnLoan: loan._id,
      idempotencyKey: "transaction_history_payment_001",
      amount: 2000,
      interestPaid: 2000,
      principalPaid: 0,
      paymentMethod: "cash",
      paidAt: new Date("2026-11-05T10:00:00Z"),
      recordedBy: userId,
      reference: "TEST-PAY-001",
    });

    await PawnLoanRenewal.create({
      pawnLoan: loan._id,
      idempotencyKey: "transaction_history_renewal_001",
      previousMaturityDate: new Date("2027-05-01"),
      newMaturityDate: new Date("2027-11-01"),
      renewedAt: new Date("2026-11-10T10:00:00Z"),
      renewedBy: userId,
      settingsVersion: 1,
      interestSettled: 2500,
      renewalFeePaid: 500,
      notes: "Test renewal",
    });

    await PawnLoanRedemption.create({
      pawnLoan: loan._id,
      idempotencyKey: "transaction_history_redemption_001",
      redeemedAt: new Date("2026-11-15T10:00:00Z"),
      redeemedBy: userId,
      settingsVersion: 1,
      principalSettled: 90000,
      interestSettled: 1000,
      penaltySettled: 0,
      totalSettled: 91000,
      releasedGoldItems: [
        loan.goldItems[0],
      ],
      notes: "Test redemption",
    });

    // Combined history
    const history = await requestHistory();

    assert.equal(history.statusCode, 200);
    assert.equal(history.body.count, 3);
    assert.equal(history.body.pagination.total, 3);

    assert.deepEqual(
      history.body.transactions.map((item) => item.type),
      ["redemption", "renewal", "payment"]
    );

    // Amounts
    assert.equal(history.body.transactions[0].amount, 91000);
    assert.equal(history.body.transactions[1].amount, 3000);
    assert.equal(history.body.transactions[2].amount, 2000);

   
    // Sensitive data exposure protection.
    const allowedFields = {
      payment: [
        "id",
        "type",
        "transactionDate",
        "amount",
        "interestPaid",
        "principalPaid",
        "paymentMethod",
        "reference",
        "recordedBy",
      ],
      renewal: [
        "id",
        "type",
        "transactionDate",
        "amount",
        "interestSettled",
        "renewalFeePaid",
        "previousMaturityDate",
        "newMaturityDate",
        "settingsVersion",
        "recordedBy",
      ],
      redemption: [
        "id",
        "type",
        "transactionDate",
        "amount",
        "principalSettled",
        "interestSettled",
        "penaltySettled",
        "settingsVersion",
        "recordedBy",
      ],
    };

    for (const transaction of history.body.transactions) {
      assert.equal(transaction.idempotencyKey, undefined);
      assert.equal(transaction.__v, undefined);
      assert.equal(transaction.pawnLoan, undefined);
      assert.equal(transaction.settingsSnapshot, undefined);

      assert.deepEqual(
        Object.keys(transaction).sort(),
        [...allowedFields[transaction.type]].sort(),
        `Unexpected fields exposed for ${transaction.type}`
      );
    }



    // Data isolation: another loan must not expose this loan's history.
    const otherLoan = await PawnLoan.create({
      loanNumber: "SIG-TRANSACTION-HISTORY-002",
      customer: new mongoose.Types.ObjectId(),
      goldItems: [new mongoose.Types.ObjectId()],
      principalAmount: 50000,
      interestRate: 2,
      issueDate: new Date("2026-11-01T00:00:00Z"),
      maturityDate: new Date("2027-05-01T00:00:00Z"),
      status: "active",
      settingsVersion: 1,
      settingsSnapshot: loan.settingsSnapshot,
      createdBy: userId,
    });

    // No transactions belong to the second loan yet.
    const otherLoanEmpty = await requestHistory({
      loanId: String(otherLoan._id),
    });

    assert.equal(otherLoanEmpty.statusCode, 200);
    assert.equal(otherLoanEmpty.body.count, 0);
    assert.equal(otherLoanEmpty.body.pagination.total, 0);
    assert.deepEqual(otherLoanEmpty.body.transactions, []);

    // Add a payment belonging exclusively to the second loan.
    await PawnPayment.create({
      pawnLoan: otherLoan._id,
      idempotencyKey: "transaction_history_other_loan_001",
      amount: 1500,
      interestPaid: 1500,
      principalPaid: 0,
      paymentMethod: "cash",
      paidAt: new Date("2026-11-20T10:00:00Z"),
      recordedBy: userId,
      reference: "TEST-OTHER-LOAN",
    });

    const otherLoanHistory = await requestHistory({
      loanId: String(otherLoan._id),
    });

    assert.equal(otherLoanHistory.statusCode, 200);
    assert.equal(otherLoanHistory.body.count, 1);
    assert.equal(otherLoanHistory.body.pagination.total, 1);
    assert.equal(otherLoanHistory.body.transactions[0].type, "payment");
    assert.equal(
      otherLoanHistory.body.transactions[0].reference,
      "TEST-OTHER-LOAN"
    );

    // Original loan must still contain exactly its own three transactions.
    const originalLoanHistory = await requestHistory();

    assert.equal(originalLoanHistory.statusCode, 200);
    assert.equal(originalLoanHistory.body.count, 3);
    assert.equal(originalLoanHistory.body.pagination.total, 3);

    assert.equal(
      originalLoanHistory.body.transactions.some(
        (transaction) =>
          transaction.reference === "TEST-OTHER-LOAN"
      ),
      false
    );


    // Pagination
    const firstPage = await requestHistory({
      query: { page: "1", limit: "2" },
    });

    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.count, 2);
    assert.equal(firstPage.body.pagination.totalPages, 2);

    const secondPage = await requestHistory({
      query: { page: "2", limit: "2" },
    });

    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.body.count, 1);
    assert.equal(secondPage.body.transactions[0].type, "payment");

    // Invalid pagination
    for (const query of [
      { page: "0" },
      { limit: "101" },
      { page: "abc" },
{ page: "101", limit: "100" }, // Exceeds 10,000 records
{ page: "1000000000", limit: "20" }, // Excessive page
{ page: "9007199254740991", limit: "100" }, // Unsafe multiplication
{ unexpected: "value" },
    ]) {
      const response = await requestHistory({ query });
      assert.equal(response.statusCode, 400);
    }

    // Invalid ID
    assert.equal(
      (await requestHistory({ loanId: "invalid" })).statusCode,
      400
    );

    // Unknown loan
    assert.equal(
      (
        await requestHistory({
          loanId: new mongoose.Types.ObjectId(),
        })
      ).statusCode,
      404
    );

    // Authentication
    assert.equal(
      (await requestHistory({ user: null })).statusCode,
      401
    );

    // Authorization
    assert.equal(
      (
        await requestHistory({
          user: {
            _id: userId,
            role: "staff",
            isActive: false,
          },
        })
      ).statusCode,
      403
    );

    // Active Staff is allowed
    assert.equal(
      (
        await requestHistory({
          user: {
            _id: userId,
            role: "staff",
            isActive: true,
          },
        })
      ).statusCode,
      200
    );

    // Read-only verification
    const loanAfter = await PawnLoan.findById(loan._id);

    assert.equal(loanAfter.principalAmount, 100000);
    assert.equal(
      loanAfter.maturityDate.toISOString(),
      "2027-05-01T00:00:00.000Z"
    );

    assert.equal(
      await PawnPayment.countDocuments({ pawnLoan: loan._id }),
      1
    );

    assert.equal(
      await PawnLoanRenewal.countDocuments({ pawnLoan: loan._id }),
      1
    );

    assert.equal(
      await PawnLoanRedemption.countDocuments({ pawnLoan: loan._id }),
      1
    );

    console.log("Combined transaction history integration: PASSED");
  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
