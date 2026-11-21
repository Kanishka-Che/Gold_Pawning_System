
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:3002";

const createToken = ({ userId, sessionId }) => {
  return jwt.sign(
    {
      userId: String(userId),
      sessionId,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );
};

test("Pawn loan renewal HTTP security", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_renewal_http_${randomUUID().replaceAll("-", "")}`;

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

    const baseUrl =
      `http://127.0.0.1:${port}/api/pawn-loans`;

    const loanId =
      new mongoose.Types.ObjectId().toString();

    const createUserSession = async ({
      role = "staff",
      isActive = true,
      expired = false,
    } = {}) => {
      const user = await User.create({
        username:
          `renewal_${randomUUID().replaceAll("-", "")}`,
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

      return createToken({
        userId: user._id,
        sessionId,
      });
    };

    const requestRenewal = async ({
      token,
      origin = CLIENT_URL,
      method = "POST",
    } = {}) => {
      const headers = {
        "Content-Type": "application/json",
        Origin: origin,
      };

      if (token) {
        headers.Cookie = `sigiri_auth=${token}`;
      }

      const response = await fetch(
        `${baseUrl}/${loanId}/renew`,
        {
          method,
          headers,
          body: JSON.stringify({
            idempotencyKey: randomUUID(),
            notes: "HTTP security test",
          }),
        }
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    // 1. Missing authentication
    const unauthenticated = await requestRenewal();

    assert.equal(unauthenticated.status, 401);

    // 2. Invalid JWT
    const invalidJwt = await requestRenewal({
      token: "invalid.jwt.token",
    });

    assert.equal(invalidJwt.status, 401);

    // 3. Expired database session
    const expiredToken = await createUserSession({
      expired: true,
    });

    const expiredSession = await requestRenewal({
      token: expiredToken,
    });

    assert.equal(expiredSession.status, 401);

    // 4. Inactive user
    const inactiveToken = await createUserSession({
      isActive: false,
    });

    const inactiveUser = await requestRenewal({
      token: inactiveToken,
    });

    assert.equal(inactiveUser.status, 401);

    // 5. Active Admin
    const adminToken = await createUserSession({
      role: "admin",
    });

    const adminResponse = await requestRenewal({
      token: adminToken,
    });

    assert.equal(adminResponse.status, 404);
    assert.match(
      adminResponse.body.message,
      /pawn loan not found/i
    );

    // 6. Active Staff
    const staffToken = await createUserSession({
      role: "staff",
    });

    const staffResponse = await requestRenewal({
      token: staffToken,
    });

    assert.equal(staffResponse.status, 404);
    assert.match(
      staffResponse.body.message,
      /pawn loan not found/i
    );

    // 7. Untrusted Origin
    const untrustedOrigin = await requestRenewal({
      token: adminToken,
      origin: "https://untrusted.example",
    });

    assert.equal(untrustedOrigin.status, 403);
    assert.match(
      untrustedOrigin.body.message,
      /origin not allowed/i
    );

    // 8. Missing Origin
    const missingOriginResponse = await fetch(
      `${baseUrl}/${loanId}/renew`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sigiri_auth=${adminToken}`,
        },
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          notes: "Missing Origin test",
        }),
      }
    );

    assert.equal(missingOriginResponse.status, 403);

    console.log(
      "Renewal HTTP authentication and security: PASSED"
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
