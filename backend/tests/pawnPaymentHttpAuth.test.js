
import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";

test("Reject unauthenticated HTTP payment request", async () => {
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
          "Origin":
            process.env.CLIENT_URL ||
            "http://localhost:3002",
        },
        body: JSON.stringify({
          pawnLoanId: "507f1f77bcf86cd799439011",
          amount: 5000,
          paymentMethod: "cash",
          reference: "",
          idempotencyKey:
            "test-http-auth-123456789",
        }),
      }
    );

    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.success, false);

    console.log(
      "Unauthenticated HTTP payment rejected: PASSED"
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
