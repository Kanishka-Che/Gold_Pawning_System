
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";

test("Reject JWT signed with incorrect secret", async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  // Valid JWT structure, but signed using a different secret.
  const wrongSecret = randomUUID();

  const token = jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      sessionId: randomUUID(),
    },
    wrongSecret,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );

  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve, reject) => {
      if (server.listening) {
        resolve();
        return;
      }

      server.once("listening", resolve);
      server.once("error", reject);
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
          pawnLoanId:
            new mongoose.Types.ObjectId().toString(),
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
      /invalid or expired session/i
    );

    console.log("Invalid JWT signature rejected: PASSED");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
