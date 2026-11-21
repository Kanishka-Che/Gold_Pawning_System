
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";
import PawnLoanRedemption from "../models/PawnLoanRedemption.js";

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:3002";

const newId = () => new mongoose.Types.ObjectId();

test("Pawn loan redemption HTTP security", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_redemption_http_${randomUUID().replaceAll("-", "")}`;

  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${dbName}`;

  let server;
  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    await User.init();
    await Session.init();
    await PawnLoanRedemption.init();

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
      if (server.listening) {
        resolve();
      } else {
        server.once("listening", resolve);
        server.once("error", reject);
      }
    });

    const { port } = server.address();

    const baseUrl =
      `http://127.0.0.1:${port}/api/pawn-loans`;

    const loanId = newId().toString();

    const createUserToken = async ({
      role = "staff",
      isActive = true,
      expired = false,
      revoked = false,
    } = {}) => {
      const user = await User.create({
        username:
          `redemption_${randomUUID().replaceAll("-", "")}`,
        password: "test-only-not-a-real-password-hash",
        role,
        isActive,
      });

      const sessionId = randomUUID();

      await Session.create({
        userId: user._id,
        sessionId,
        expiresAt: new Date(
          Date.now() + (expired ? -60000 : 3600000)
        ),
        revokedAt: revoked ? new Date() : null,
      });

      return jwt.sign(
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
    };

    const requestRedemption = async ({
      token,
      origin = CLIENT_URL,
      id = loanId,
      body = {
        idempotencyKey: randomUUID(),
        notes: "HTTP security test",
      },
    } = {}) => {
      const headers = {
        "Content-Type": "application/json",
      };

      if (origin !== null) {
        headers.Origin = origin;
      }

      if (token) {
        headers.Cookie = `sigiri_auth=${token}`;
      }

      const response = await fetch(
        `${baseUrl}/${id}/redeem`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    // 1. Missing authentication
    const unauthenticated = await requestRedemption();

    assert.equal(unauthenticated.status, 401);

    // 2. Invalid JWT
    const invalidJwt = await requestRedemption({
      token: "invalid.jwt.token",
    });

    assert.equal(invalidJwt.status, 401);

    // 3. Expired session
    const expiredToken = await createUserToken({
      expired: true,
    });

    const expiredSession = await requestRedemption({
      token: expiredToken,
    });

    assert.equal(expiredSession.status, 401);

    // 4. Revoked session
    const revokedToken = await createUserToken({
      revoked: true,
    });

    const revokedSession = await requestRedemption({
      token: revokedToken,
    });

    assert.equal(revokedSession.status, 401);

    // 5. Inactive user
    const inactiveToken = await createUserToken({
      isActive: false,
    });

    const inactiveUser = await requestRedemption({
      token: inactiveToken,
    });

    assert.equal(inactiveUser.status, 401);

    // 6. Active Admin
    const adminToken = await createUserToken({
      role: "admin",
    });

    const adminResponse = await requestRedemption({
      token: adminToken,
    });

    assert.equal(adminResponse.status, 404);
    assert.match(
      adminResponse.body.message,
      /pawn loan not found/i
    );

    // 7. Active Staff
    const staffToken = await createUserToken({
      role: "staff",
    });

    const staffResponse = await requestRedemption({
      token: staffToken,
    });

    assert.equal(staffResponse.status, 404);

    // 8. Untrusted Origin
    const untrustedOrigin = await requestRedemption({
      token: adminToken,
      origin: "https://untrusted.example",
    });

    assert.equal(untrustedOrigin.status, 403);

    // 9. Missing Origin
    const missingOrigin = await requestRedemption({
      token: adminToken,
      origin: null,
    });

    assert.equal(missingOrigin.status, 403);

    // 10. Invalid loan ID
    const invalidLoanId = await requestRedemption({
      token: adminToken,
      id: "invalid-loan-id",
    });

    assert.equal(invalidLoanId.status, 400);

    // 11. Invalid idempotency key
    const invalidKey = await requestRedemption({
      token: adminToken,
      body: {
        idempotencyKey: "short",
      },
    });

    assert.equal(invalidKey.status, 400);

    // 12. Reject client-supplied financial amounts
    const financialInjection = await requestRedemption({
      token: adminToken,
      body: {
        idempotencyKey: randomUUID(),
        principalSettled: 0,
        interestSettled: 0,
        totalSettled: 0,
      },
    });

    assert.equal(financialInjection.status, 400);

    // 13. Reject client-supplied gold release
    const goldReleaseInjection = await requestRedemption({
      token: adminToken,
      body: {
        idempotencyKey: randomUUID(),
        releasedGoldItems: [newId().toString()],
      },
    });

    assert.equal(goldReleaseInjection.status, 400);

    // 14. Reject excessive notes
    const invalidNotes = await requestRedemption({
      token: adminToken,
      body: {
        idempotencyKey: randomUUID(),
        notes: "x".repeat(501),
      },
    });

    assert.equal(invalidNotes.status, 400);

    // 15. Confirm no redemption record was created
    const redemptionCount =
      await PawnLoanRedemption.countDocuments();

    assert.equal(redemptionCount, 0);

    console.log(
      "Redemption HTTP authentication and security: PASSED"
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
