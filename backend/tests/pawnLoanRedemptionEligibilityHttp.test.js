
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";
import PawnLoan from "../models/PawnLoan.js";
import GoldItem from "../models/GoldItem.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:3002";

const newId = () => new mongoose.Types.ObjectId();

test("Pawn loan redemption eligibility HTTP integration", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_redemption_elig_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  let server;
  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    await Promise.all([
      User.init(),
      Session.init(),
      PawnLoan.init(),
      GoldItem.init(),
      PawnLoanRedemption.init(),
    ]);

    const user = await User.create({
      username:
        `redemption_${randomUUID().replaceAll("-", "")}`,
      password: "test-only-not-a-real-password-hash",
      role: "admin",
      isActive: true,
    });

    const sessionId = randomUUID();

    await Session.create({
      userId: user._id,
      sessionId,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
    });

    const token = jwt.sign(
      {
        userId: String(user._id),
        sessionId,
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h",
      }
    );

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
      if (server.listening) resolve();
      else {
        server.once("listening", resolve);
        server.once("error", reject);
      }
    });

    const { port } = server.address();

    const baseUrl =
      `http://127.0.0.1:${port}/api/pawn-loans`;

    const customerId = newId();

    const createLoanWithGold = async ({
      status = "active",
      goldStatus = "pledged",
      wrongReservation = false,
    } = {}) => {
      const loanId = newId();
      const goldId = newId();

      const loan = await PawnLoan.create({
        _id: loanId,
        loanNumber:
          `SIG-REDEEM-${randomUUID().replaceAll("-", "")}`,
        customer: customerId,
        goldItems: [goldId],
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
        },
        createdBy: user._id,
      });

      const goldItem = await GoldItem.create({
        _id: goldId,
        itemType: "Ring",
        description: "Redemption eligibility test gold",
        karat: "22K",
        grossWeight: 10,
        deductionWeight: 0.5,
        netWeight: 9.5,
        status: goldStatus,
        reservedForLoan: wrongReservation
          ? newId()
          : loan._id,
        createdBy: user._id,
      });

      return { loan, goldItem };
    };

    const requestRedemption = async (loanId) => {
      const response = await fetch(
        `${baseUrl}/${loanId}/redeem`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: CLIENT_URL,
            Cookie: `sigiri_auth=${token}`,
          },
          body: JSON.stringify({
            idempotencyKey: randomUUID(),
            notes: "Eligibility HTTP test",
          }),
        }
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    // 1. Draft loan cannot be redeemed.
    const draft = await createLoanWithGold({
      status: "draft",
      goldStatus: "draft",
    });

    const draftResponse =
      await requestRedemption(draft.loan._id);

    assert.equal(draftResponse.status, 409);
    assert.equal(
      draftResponse.body.code,
      "REDEMPTION_NOT_ELIGIBLE"
    );

    // 2. Already redeemed loan cannot be redeemed.
    const redeemed = await createLoanWithGold({
      status: "redeemed",
      goldStatus: "released",
    });

    const redeemedResponse =
      await requestRedemption(redeemed.loan._id);

    assert.equal(redeemedResponse.status, 409);
    assert.equal(
      redeemedResponse.body.code,
      "REDEMPTION_NOT_ELIGIBLE"
    );

    // 3. Released gold item must be rejected.
    const releasedGold = await createLoanWithGold({
      status: "active",
      goldStatus: "released",
    });

    const releasedResponse =
      await requestRedemption(releasedGold.loan._id);

    assert.equal(releasedResponse.status, 409);
    assert.equal(
      releasedResponse.body.code,
      "REDEMPTION_GOLD_ITEMS_INVALID"
    );

    // 4. Gold reserved for another loan must be rejected.
    const wrongReservation = await createLoanWithGold({
      status: "active",
      goldStatus: "pledged",
      wrongReservation: true,
    });

    const reservationResponse =
      await requestRedemption(wrongReservation.loan._id);

    assert.equal(reservationResponse.status, 409);
    assert.equal(
      reservationResponse.body.code,
      "REDEMPTION_GOLD_ITEMS_INVALID"
    );

    // 5. Eligible loan must return 501.
    const eligible = await createLoanWithGold();

    const originalPrincipal =
      eligible.loan.principalAmount;

    const originalPaymentVersion =
      eligible.loan.paymentVersion;

    const eligibleResponse =
      await requestRedemption(eligible.loan._id);

    assert.equal(
      eligibleResponse.status,
      501,
      JSON.stringify(eligibleResponse.body)
    );

    assert.equal(
      eligibleResponse.body.code,
      "REDEMPTION_POSTING_DISABLED"
    );

    // 6. Verify the loan was not changed.
    const loanAfter = await PawnLoan.findById(
      eligible.loan._id
    );

    assert.equal(loanAfter.status, "active");
    assert.equal(
      loanAfter.principalAmount,
      originalPrincipal
    );
    assert.equal(
      loanAfter.paymentVersion,
      originalPaymentVersion
    );
    assert.equal(loanAfter.redeemedAt, null);

    // 7. Verify the gold was not released.
    const goldAfter = await GoldItem.findById(
      eligible.goldItem._id
    );

    assert.equal(goldAfter.status, "pledged");
    assert.equal(
      String(goldAfter.reservedForLoan),
      String(eligible.loan._id)
    );

    // 8. No redemption records may be created.
    const redemptionCount =
      await PawnLoanRedemption.countDocuments();

    assert.equal(redemptionCount, 0);

    console.log(
      "Redemption eligibility and disabled posting: PASSED"
    );
  } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    if (connected) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  }
});
