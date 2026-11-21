
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

test("Logout revokes session and blocks old JWT", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_logout_test_${randomUUID().replaceAll("-", "")}`;

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

    const username =
      `test_${randomUUID().replaceAll("-", "")}`;

    const password = `Test-${randomUUID()}!`;

    await User.create({
      username,
      password: await bcrypt.hash(password, 10),
      role: "staff",
      isActive: true,
    });

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
      if (server.listening) {
        resolve();
        return;
      }

      server.once("listening", resolve);
      server.once("error", reject);
    });

    const baseUrl =
      `http://127.0.0.1:${server.address().port}`;

    const origin =
      process.env.CLIENT_URL ||
      "http://localhost:3002";

    // 1. Login
    const loginResponse = await fetch(
      `${baseUrl}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    assert.equal(loginResponse.status, 200);

    const setCookie =
      loginResponse.headers.get("set-cookie");

    assert.ok(setCookie);

    const authCookie = setCookie.split(";")[0];

    assert.match(authCookie, /^sigiri_auth=/);

    console.log("Login successful: PASSED");

    // 2. Verify session works before logout
    const beforeLogout = await fetch(
      `${baseUrl}/api/auth/me`,
      {
        headers: {
          Cookie: authCookie,
        },
      }
    );

    assert.equal(beforeLogout.status, 200);

    console.log("Session valid before logout: PASSED");

    // 3. Logout
    const logoutResponse = await fetch(
      `${baseUrl}/api/auth/logout`,
      {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: authCookie,
        },
      }
    );

    assert.equal(logoutResponse.status, 200);

    const logoutData = await logoutResponse.json();

    assert.equal(logoutData.success, true);

    console.log("Logout successful: PASSED");

    // 4. Confirm session was revoked in MongoDB
    const session = await Session.findOne();

    assert.ok(session);
    assert.ok(session.revokedAt instanceof Date);

    console.log("Database session revoked: PASSED");

    // 5. Attempt to reuse old cookie
    const afterLogout = await fetch(
      `${baseUrl}/api/pawn-payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: authCookie,
        },
        body: JSON.stringify({
          pawnLoanId:
            new mongoose.Types.ObjectId().toString(),
          amount: 5000,
          paymentMethod: "cash",
          reference: "",
          idempotencyKey: randomUUID(),
        }),
      }
    );

    const afterLogoutData = await afterLogout.json();

    assert.equal(afterLogout.status, 401);
    assert.equal(afterLogoutData.success, false);

    assert.match(
      afterLogoutData.message,
      /session expired or revoked/i
    );

    console.log("Old JWT rejected after logout: PASSED");
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
