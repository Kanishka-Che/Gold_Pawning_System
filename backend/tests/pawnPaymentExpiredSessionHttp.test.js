
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

test("Reject expired database session on payment endpoint", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_expired_session_${randomUUID().replaceAll("-", "")}`;

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

    const user = await User.create({
      username: `test_${randomUUID().replaceAll("-", "")}`,
      password: "test-only-not-a-real-password-hash",
      role: "staff",
      isActive: true,
    });

    const sessionId = randomUUID();

    // JWT remains valid, but database session has expired
    await Session.create({
      userId: user._id,
      sessionId,
      expiresAt: new Date(Date.now() - 60 * 1000),
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
      if (server.listening) {
        resolve();
      } else {
        server.once("listening", resolve);
        server.once("error", reject);
      }
    });

    const { port } = server.address();

    const response = await fetch(
      `http://127.0.0.1:${port}/api/pawn-payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin:
            process.env.CLIENT_URL ||
            "http://localhost:3002",
          Cookie: `sigiri_auth=${token}`,
        },
        body: JSON.stringify({
          pawnLoanId: new mongoose.Types.ObjectId().toString(),
          amount: 5000,
          paymentMethod: "cash",
          reference: "",
          idempotencyKey: randomUUID(),
        }),
      }
    );

    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.success, false);

    assert.match(
      data.message,
      /session expired or revoked/i
    );

    console.log("Expired database session rejected: PASSED");
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
