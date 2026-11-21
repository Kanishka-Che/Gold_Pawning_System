
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

test("Renewal history HTTP authentication and authorization", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_renewal_get_${randomUUID().replaceAll("-", "")}`;

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
      if (server.listening) {
        resolve();
      } else {
        server.once("listening", resolve);
        server.once("error", reject);
      }
    });

    const { port } = server.address();
    const loanId = new mongoose.Types.ObjectId().toString();

    const baseUrl =
      `http://127.0.0.1:${port}/api/pawn-loans/${loanId}/renewals`;

    const createUserToken = async ({
      role = "staff",
      isActive = true,
      expired = false,
    } = {}) => {
      const user = await User.create({
        username: `renewal_${randomUUID().replaceAll("-", "")}`,
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
        revokedAt: null,
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
    } = {}) => {
      const headers = {};

      if (token) {
        headers.Cookie = `sigiri_auth=${token}`;
      }

      const response = await fetch(
        `${baseUrl}${query}`,
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

    // 3. Expired database session
    const expiredToken = await createUserToken({
      expired: true,
    });

    const expiredSession = await requestHistory({
      token: expiredToken,
    });

    assert.equal(expiredSession.status, 401);

    // 4. Inactive user
    const inactiveToken = await createUserToken({
      isActive: false,
    });

    const inactiveUser = await requestHistory({
      token: inactiveToken,
    });

    assert.equal(inactiveUser.status, 401);

    // 5. Active Admin reaches controller
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

    // 6. Active Staff reaches controller
    const staffToken = await createUserToken({
      role: "staff",
    });

    const staffResponse = await requestHistory({
      token: staffToken,
    });

    assert.equal(staffResponse.status, 404);

    // 7. Invalid loan ID
    const invalidLoanResponse = await fetch(
      `http://127.0.0.1:${port}/api/pawn-loans/invalid-id/renewals`,
      {
        headers: {
          Cookie: `sigiri_auth=${adminToken}`,
        },
      }
    );

    assert.equal(invalidLoanResponse.status, 400);

    // 8. Invalid pagination
    const invalidPagination = await requestHistory({
      token: adminToken,
      query: "?page=0&limit=101",
    });

    assert.equal(invalidPagination.status, 400);

    // 9. Unexpected query parameter
    const unexpectedQuery = await requestHistory({
      token: adminToken,
      query: "?unexpected=value",
    });

    assert.equal(unexpectedQuery.status, 400);

    console.log(
      "Renewal history HTTP security: PASSED"
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
