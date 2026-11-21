
import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";

test("Reject invalid JWT cookie on payment endpoint", async () => {
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve) => {
      if (server.listening) {
        resolve();
      } else {
        server.once("listening", resolve);
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
          Cookie: "sigiri_auth=invalid.jwt.token",
        },
        body: JSON.stringify({
          pawnLoanId: "507f1f77bcf86cd799439011",
          amount: 5000,
          paymentMethod: "cash",
          reference: "",
          idempotencyKey: "invalid-jwt-test-123456",
        }),
      }
    );

    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.success, false);

    assert.match(
      data.message,
      /invalid|expired|session/i
    );

    console.log("Invalid JWT rejected: PASSED");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
