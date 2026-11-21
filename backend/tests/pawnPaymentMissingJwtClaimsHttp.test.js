
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";

test("Reject JWT missing required authentication claims", async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve, reject) => {
      if (server.listening) {
        resolve();
      } else {
        server.once("listening", resolve);
        server.once("error", reject);
      }
    });

    const baseUrl =
      `http://127.0.0.1:${server.address().port}`;

    const cases = [
      {
        name: "Missing userId",
        payload: {
          sessionId: randomUUID(),
        },
      },
      {
        name: "Missing sessionId",
        payload: {
          userId: new mongoose.Types.ObjectId().toString(),
        },
      },
    ];

    for (const scenario of cases) {
      const token = jwt.sign(
        scenario.payload,
        process.env.JWT_SECRET,
        {
          algorithm: "HS256",
          expiresIn: "1h",
        }
      );

      const response = await fetch(
        `${baseUrl}/api/pawn-payments`,
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

      assert.equal(
        response.status,
        401,
        `${scenario.name} should be rejected`
      );

      assert.equal(data.success, false);

      assert.match(
        data.message,
        /invalid session/i
      );

      console.log(`${scenario.name}: PASSED`);
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
