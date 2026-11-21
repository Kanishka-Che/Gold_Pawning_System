
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

const newId = () => new mongoose.Types.ObjectId();

const makeRedemption = (overrides = {}) => ({
  pawnLoan: newId(),
  idempotencyKey: randomUUID(),
  redeemedAt: new Date(),
  redeemedBy: newId(),
  settingsVersion: 1,
  principalSettled: 10000,
  interestSettled: 500,
  penaltySettled: 0,
  totalSettled: 10500,
  releasedGoldItems: [newId()],
  notes: "Integration test only",
  ...overrides,
});

test("Pawn loan redemption MongoDB integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  const dbName =
    `sigiri_redemption_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    // Ensure unique indexes exist before testing.
    await PawnLoanRedemption.init();

    const loanId = newId();
    const idempotencyKey = randomUUID();

    // 1. Save a valid redemption record.
    const first = await PawnLoanRedemption.create(
      makeRedemption({
        pawnLoan: loanId,
        idempotencyKey,
      })
    );

    assert.ok(first._id);

    const saved = await PawnLoanRedemption.findById(
      first._id
    ).lean();

    assert.equal(
      String(saved.pawnLoan),
      String(loanId)
    );

    console.log("Redemption record saved: PASSED");

    // 2. Reject duplicate idempotency key.
    await assert.rejects(
      PawnLoanRedemption.create(
        makeRedemption({
          pawnLoan: newId(),
          idempotencyKey,
        })
      ),
      (error) => error?.code === 11000
    );

    console.log(
      "Duplicate idempotency key rejected: PASSED"
    );

    // 3. Reject a second redemption for same loan.
    await assert.rejects(
      PawnLoanRedemption.create(
        makeRedemption({
          pawnLoan: loanId,
          idempotencyKey: randomUUID(),
        })
      ),
      (error) => error?.code === 11000
    );

    console.log(
      "Duplicate pawn loan redemption rejected: PASSED"
    );

    // 4. Allow a different loan and key.
    const second = await PawnLoanRedemption.create(
      makeRedemption({
        pawnLoan: newId(),
        idempotencyKey: randomUUID(),
      })
    );

    assert.ok(second._id);

    const count =
      await PawnLoanRedemption.countDocuments();

    assert.equal(count, 2);

    console.log(
      "Independent redemption record saved: PASSED"
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
