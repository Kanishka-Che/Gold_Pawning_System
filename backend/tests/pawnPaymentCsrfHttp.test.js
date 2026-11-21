
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";

test("Reject payment request from untrusted origin", async () => {
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
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify({
          pawnLoanId: "507f1f77bcf86cd799439011",
          amount: 5000,
          paymentMethod: "cash",
          reference: "",
          idempotencyKey: "csrf-test-1234567890123456",
        }),
      }
    );

    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.success, false);

    assert.match(
      data.message,
      /request origin not allowed/i
    );

    console.log("Untrusted origin rejected: PASSED");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
