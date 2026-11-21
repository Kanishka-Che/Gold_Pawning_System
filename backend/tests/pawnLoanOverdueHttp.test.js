
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import app from "../app.js";

let server;
let baseUrl;

before(async () => {
  server = createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) =>
        error ? reject(error) : resolve()
      );
    });
  }
});

test("Overdue endpoint rejects unauthenticated request", async () => {
  const response = await fetch(
    `${baseUrl}/api/pawn-loans/overdue`
  );

  assert.equal(response.status, 401);
});

test("Overdue endpoint rejects unauthenticated pagination request", async () => {
  const response = await fetch(
    `${baseUrl}/api/pawn-loans/overdue?page=1&limit=20`
  );

  assert.equal(response.status, 401);
});

test("Overdue endpoint rejects unauthenticated invalid query", async () => {
  const response = await fetch(
    `${baseUrl}/api/pawn-loans/overdue?page=abc`
  );

  // Authentication must be checked before query validation.
  assert.equal(response.status, 401);
});
