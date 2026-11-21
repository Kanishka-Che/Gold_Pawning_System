
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import app from "../app.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

test("Login sets secure authentication cookie attributes", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const dbName =
    `sigiri_cookie_test_${randomUUID().replaceAll("-", "")}`;

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
    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      username,
      password: passwordHash,
      role: "staff",
      isActive: true,
    });

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
      `http://127.0.0.1:${port}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin:
            process.env.CLIENT_URL ||
            "http://localhost:3002",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);

    const cookie = response.headers.get("set-cookie");

    assert.ok(cookie, "Set-Cookie header is missing");

    assert.match(cookie, /^sigiri_auth=/i);
    assert.match(cookie, /;\s*HttpOnly/i);
    assert.match(cookie, /;\s*SameSite=Lax/i);
    assert.match(cookie, /;\s*Path=\//i);
    assert.match(cookie, /;\s*Max-Age=28800/i);

    if (process.env.NODE_ENV === "production") {
      assert.match(cookie, /;\s*Secure/i);
    } else {
      assert.doesNotMatch(cookie, /;\s*Secure/i);
    }

    assert.equal(
      await Session.countDocuments(),
      1
    );

    console.log("Login cookie security attributes: PASSED");
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
