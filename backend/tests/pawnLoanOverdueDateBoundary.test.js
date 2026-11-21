
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import { calculateOverdueStatus } from "../utils/overdueCalculator.js";

const newId = () => new mongoose.Types.ObjectId();

test("Overdue Sri Lanka date boundary integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const uri = new URL(process.env.MONGO_URI);

  uri.pathname =
    `/sigiri_overdue_boundary_${randomUUID().replaceAll("-", "")}`;

  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    await PawnLoan.init();

    const userId = newId();

    const createLoan = async ({
      loanNumber,
      maturityDate,
      gracePeriodDays = 0,
    }) =>
      PawnLoan.create({
        loanNumber,
        customer: newId(),
        goldItems: [newId()],
        principalAmount: 100000,
        interestRate: 2,
        issueDate: new Date("2026-01-01T00:00:00Z"),
        maturityDate,
        status: "active",
        settingsVersion: 1,
        settingsSnapshot: {
          interest: {
            rate: 2,
            calculationMethod: "monthly",
            principalCalculationMethod:
              "original_principal",
          },
          loan: {
            defaultDurationMonths: 6,
          },
          overdue: {
            gracePeriodDays,
          },
        },
        createdBy: userId,
      });

    // Sri Lanka Nov 21, 2026, 00:00
    const todayStartUtc =
      new Date("2026-11-20T18:30:00Z");

    // Sri Lanka Nov 21, 2026, 18:00
    const calculationDate =
      new Date("2026-11-21T12:30:00Z");

    const yesterdayLoan = await createLoan({
      loanNumber: "SIG-BOUNDARY-001",
      maturityDate:
        new Date("2026-11-20T18:29:59Z"),
    });

    const todayLoan = await createLoan({
      loanNumber: "SIG-BOUNDARY-002",
      maturityDate:
        new Date("2026-11-20T18:30:00Z"),
    });

    const laterTodayLoan = await createLoan({
      loanNumber: "SIG-BOUNDARY-003",
      maturityDate:
        new Date("2026-11-21T10:00:00Z"),
    });

    const queryLoans = await PawnLoan.find({
      status: "active",
      maturityDate: { $lt: todayStartUtc },
    }).lean();

    const queriedIds = queryLoans.map(
      (loan) => String(loan._id)
    );

    // Yesterday's loan must be included
    assert.equal(
      queriedIds.includes(String(yesterdayLoan._id)),
      true
    );

    // Today's loans must be excluded
    assert.equal(
      queriedIds.includes(String(todayLoan._id)),
      false
    );

    assert.equal(
      queriedIds.includes(String(laterTodayLoan._id)),
      false
    );

    // Calculator agrees with MongoDB date boundary
    const yesterdayStatus = calculateOverdueStatus({
      loan: yesterdayLoan,
      calculationDate,
    });

    assert.equal(
      yesterdayStatus.overdueStatus,
      "overdue"
    );

    const todayStatus = calculateOverdueStatus({
      loan: todayLoan,
      calculationDate,
    });

    assert.equal(
      todayStatus.overdueStatus,
      "current"
    );

    const laterTodayStatus = calculateOverdueStatus({
      loan: laterTodayLoan,
      calculationDate,
    });

    assert.equal(
      laterTodayStatus.overdueStatus,
      "current"
    );

    console.log(
      "Sri Lanka overdue date boundary: PASSED"
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
