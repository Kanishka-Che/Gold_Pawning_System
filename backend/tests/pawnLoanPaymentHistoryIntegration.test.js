
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";
import User from "../models/User.js";

import {
  getPawnLoanPaymentHistory,
} from "../controllers/pawnLoanPaymentHistoryController.js";

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

test("Pawn loan payment history integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_payment_history_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

   await PawnLoan.init();
await PawnPayment.init();
await User.init();

    const testUser = await User.create({
  username: `paymenthistory_${randomUUID().replaceAll("-", "")}`,
  password: "test-only-not-a-real-password-hash",
  role: "admin",
  isActive: true,
});

const userId = testUser._id;

    const createLoan = async (loanNumber) =>
      PawnLoan.create({
        loanNumber,
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
        },
        createdBy: userId,
      });

    const loan = await createLoan("SIG-PAY-HISTORY-001");
    const otherLoan = await createLoan("SIG-PAY-HISTORY-002");

    const requestHistory = async ({
      loanId = String(loan._id),
      page = "1",
      limit = "20",
    } = {}) => {
      const response = createResponse();

      await getPawnLoanPaymentHistory(
        {
          params: { id: String(loanId) },
          query: { page, limit },
        },
        response
      );

      return response;
    };

    // 1. Empty history
    const empty = await requestHistory();

    assert.equal(empty.statusCode, 200);
    assert.equal(empty.body.success, true);
    assert.equal(empty.body.total, 0);
    assert.deepEqual(empty.body.payments, []);

    assert.equal(empty.body.summary.totalAmount, 0);
    assert.equal(empty.body.summary.totalInterestPaid, 0);
    assert.equal(empty.body.summary.totalPrincipalPaid, 0);

    // 2. Create isolated test payments
    const fixtures = [
      {
        amount: 1500.25,
        interestPaid: 1000.25,
        principalPaid: 500,
        paidAt: "2026-11-05T10:00:00Z",
        reference: "TEST-001",
      },
      {
        amount: 2500.50,
        interestPaid: 2000.25,
        principalPaid: 500.25,
        paidAt: "2026-11-10T10:00:00Z",
        reference: "TEST-002",
      },
      {
        amount: 1000,
        interestPaid: 500,
        principalPaid: 500,
        paidAt: "2026-11-15T10:00:00Z",
        reference: "TEST-003",
      },
    ];

    for (const [index, payment] of fixtures.entries()) {
      await PawnPayment.create({
        pawnLoan: loan._id,
        idempotencyKey: `payment_history_fixture_${index}_${randomUUID().replaceAll("-", "")}`,
        amount: payment.amount,
        interestPaid: payment.interestPaid,
        principalPaid: payment.principalPaid,
        paymentMethod: "cash",
        paidAt: new Date(payment.paidAt),
        recordedBy: userId,
        reference: payment.reference,
      });
    }

    // 3. Payment belonging to another loan
    await PawnPayment.create({
      pawnLoan: otherLoan._id,
      idempotencyKey: `payment_history_other_${randomUUID().replaceAll("-", "")}`,
      amount: 9000,
      interestPaid: 9000,
      principalPaid: 0,
      paymentMethod: "bank_transfer",
      paidAt: new Date("2026-11-20T10:00:00Z"),
      recordedBy: userId,
      reference: "OTHER-LOAN",
    });

    // 4. History and totals
    const history = await requestHistory();

    assert.equal(history.statusCode, 200);
    assert.equal(history.body.total, 3);
    assert.equal(history.body.payments.length, 3);

    assert.ok(
      Math.abs(history.body.summary.totalAmount - 5000.75) < 1e-8
    );

   assert.ok(
  Math.abs(history.body.summary.totalInterestPaid - 3500.50) < 1e-8
);

assert.ok(
  Math.abs(history.body.summary.totalPrincipalPaid - 1500.25) < 1e-8
);

// Username population verification
for (const payment of history.body.payments) {
  assert.ok(
    payment.recordedBy,
    "Payment must contain recordedBy"
  );

  assert.equal(
    payment.recordedBy.username,
    testUser.username,
    "Recorded username must match the test user"
  );

  assert.equal(
    payment.recordedBy.password,
    undefined,
    "User password must not be exposed"
  );

  assert.equal(
    payment.recordedBy.role,
    undefined,
    "User role must not be exposed"
  );
}



    // 5. Latest payment first
    assert.deepEqual(
      history.body.payments.map((payment) => payment.reference),
      ["TEST-003", "TEST-002", "TEST-001"]
    );

    // 6. Loan isolation
    const otherHistory = await requestHistory({
      loanId: String(otherLoan._id),
    });

    assert.equal(otherHistory.statusCode, 200);
    assert.equal(otherHistory.body.total, 1);
    assert.equal(otherHistory.body.summary.totalAmount, 9000);
    assert.equal(
      otherHistory.body.payments[0].reference,
      "OTHER-LOAN"
    );

    assert.equal(
      history.body.payments.some(
        (payment) => payment.reference === "OTHER-LOAN"
      ),
      false
    );

    // 7. Pagination
    const firstPage = await requestHistory({
      page: "1",
      limit: "2",
    });

    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.payments.length, 2);
    assert.equal(firstPage.body.totalPages, 2);

    const secondPage = await requestHistory({
      page: "2",
      limit: "2",
    });

    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.body.payments.length, 1);
    assert.equal(
      secondPage.body.payments[0].reference,
      "TEST-001"
    );

    // 8. Invalid loan ID
    const invalidId = await requestHistory({
      loanId: "invalid-id",
    });

    assert.equal(invalidId.statusCode, 400);

    // 9. Unknown loan
    const unknownLoan = await requestHistory({
      loanId: new mongoose.Types.ObjectId(),
    });

    assert.equal(unknownLoan.statusCode, 404);

    // 10. Invalid pagination
    for (const [page, limit] of [
      ["0", "20"],
      ["1", "0"],
      ["1", "101"],
      ["abc", "20"],
      ["1.5", "20"],
    ]) {
      const result = await requestHistory({ page, limit });

      assert.equal(
        result.statusCode,
        400,
        `Expected 400 for page=${page}, limit=${limit}`
      );
    }

    // 11. Sensitive field protection
    for (const payment of history.body.payments) {
      assert.equal(payment.idempotencyKey, undefined);
      assert.equal(payment.pawnLoan, undefined);
      assert.equal(payment.__v, undefined);
    }


    // Response field whitelisting
    const allowedPaymentFields = [
      "_id",
      "amount",
      "interestPaid",
      "principalPaid",
      "paymentMethod",
      "paidAt",
      "recordedBy",
      "reference",
    ];

    for (const payment of history.body.payments) {
      assert.deepEqual(
        Object.keys(payment).sort(),
        [...allowedPaymentFields].sort(),
        "Payment response contains unexpected fields"
      );

      assert.deepEqual(
        Object.keys(payment.recordedBy).sort(),
        ["_id", "username"].sort(),
        "Recorded user contains unexpected fields"
      );
    }

    // Exact totals for the current test fixtures
    assert.equal(
      Number(history.body.summary.totalAmount.toFixed(2)),
      5000.75
    );

    assert.equal(
      Number(history.body.summary.totalInterestPaid.toFixed(2)),
      3500.50
    );

    assert.equal(
      Number(history.body.summary.totalPrincipalPaid.toFixed(2)),
      1500.25
    );


    // 12. Read-only verification
    const loanAfter = await PawnLoan.findById(loan._id);

    assert.equal(loanAfter.principalAmount, 100000);
    assert.equal(loanAfter.paymentVersion, 0);

    assert.equal(
      await PawnPayment.countDocuments({ pawnLoan: loan._id }),
      3
    );

    console.log("Payment history integration: PASSED");
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
