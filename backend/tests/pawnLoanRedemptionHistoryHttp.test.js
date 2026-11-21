
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

test("Redemption history HTTP authentication and authorization", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_redemption_history_http_${randomUUID().replaceAll("-", "")}`;

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

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
      if (server.listening) resolve();
      else {
        server.once("listening", resolve);
        server.once("error", reject);
      }
    });

    const { port } = server.address();

    const loanId =
      new mongoose.Types.ObjectId().toString();

    const baseUrl =
      `http://127.0.0.1:${port}/api/pawn-loans/${loanId}/redemptions`;

    const createUserToken = async ({
      role = "staff",
      isActive = true,
      expired = false,
      revoked = false,
    } = {}) => {
      const user = await User.create({
        username:
          `redemption_history_${randomUUID().replaceAll("-", "")}`,
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

    const requestHistory = async ({
      token,
      query = "",
      id = loanId,
    } = {}) => {
      const headers = {};

      if (token) {
        headers.Cookie = `sigiri_auth=${token}`;
      }

      const response = await fetch(
        `http://127.0.0.1:${port}/api/pawn-loans/${id}/redemptions${query}`,
        {
          method: "GET",
          headers,
        }
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    // 1. Missing authentication
    const unauthenticated = await requestHistory();

    assert.equal(unauthenticated.status, 401);

    // 2. Invalid JWT
    const invalidJwt = await requestHistory({
      token: "invalid.jwt.token",
    });

    assert.equal(invalidJwt.status, 401);

    // 3. Expired session
    const expiredToken = await createUserToken({
      expired: true,
    });

    const expiredSession = await requestHistory({
      token: expiredToken,
    });

    assert.equal(expiredSession.status, 401);

    // 4. Revoked session
    const revokedToken = await createUserToken({
      revoked: true,
    });

    const revokedSession = await requestHistory({
      token: revokedToken,
    });

    assert.equal(revokedSession.status, 401);

    // 5. Inactive user
    const inactiveToken = await createUserToken({
      isActive: false,
    });

    const inactiveUser = await requestHistory({
      token: inactiveToken,
    });

    assert.equal(inactiveUser.status, 401);

    // 6. Active Admin reaches controller
    const adminToken = await createUserToken({
      role: "admin",
    });

    const adminResponse = await requestHistory({
      token: adminToken,
    });

    assert.equal(adminResponse.status, 404);
    assert.match(
      adminResponse.body.message,
      /pawn loan not found/i
    );

    // 7. Active Staff reaches controller
    const staffToken = await createUserToken({
      role: "staff",
    });

    const staffResponse = await requestHistory({
      token: staffToken,
    });

    assert.equal(staffResponse.status, 404);

    // 8. Invalid loan ID
    const invalidLoan = await requestHistory({
      token: adminToken,
      id: "invalid-id",
    });

    assert.equal(invalidLoan.status, 400);

    // 9. Invalid page
    const invalidPage = await requestHistory({
      token: adminToken,
      query: "?page=0",
    });

    assert.equal(invalidPage.status, 400);

    // 10. Invalid limit
    const invalidLimit = await requestHistory({
      token: adminToken,
      query: "?limit=101",
    });

    assert.equal(invalidLimit.status, 400);

    // 11. Unexpected query parameter
    const unexpectedQuery = await requestHistory({
      token: adminToken,
      query: "?unexpected=value",
    });

    assert.equal(unexpectedQuery.status, 400);

    // 12. Valid pagination with unknown loan
    const validPagination = await requestHistory({
      token: adminToken,
      query: "?page=1&limit=20",
    });

    assert.equal(validPagination.status, 404);

    console.log(
      "Redemption history HTTP security: PASSED"
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
