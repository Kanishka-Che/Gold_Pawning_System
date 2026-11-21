
import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../app.js";

import User from "../models/User.js";
import Session from "../models/Session.js";
import PawnLoan from "../models/PawnLoan.js";

const newId = () => new mongoose.Types.ObjectId();

test("Overdue HTTP authentication and authorization", async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const uri = new URL(process.env.MONGO_URI);

  uri.pathname =
    `/sigiri_overdue_http_${randomUUID().replaceAll("-", "")}`;

  let server;
  let connected = false;

  try {
    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    connected = true;

    await User.init();
    await Session.init();
    await PawnLoan.init();

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
      `http://127.0.0.1:${port}/api/pawn-loans/overdue`;

    const createUserToken = async ({
      role = "staff",
      isActive = true,
      expired = false,
      revoked = false,
    } = {}) => {
      const user = await User.create({
        username:
          `overdue_http_${randomUUID().replaceAll("-", "")}`,
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
        revokedAt: revoked ? new Date() : null,
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

      return { token, user };
    };

    const requestOverdue = async ({
      token,
      query = "",
    } = {}) => {
      const headers = {};

      if (token) {
        headers.Cookie = `sigiri_auth=${token}`;
      }

      const response = await fetch(
        `${baseUrl}${query}`,
        {
          method: "GET",
          headers,
        }
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    };

    // 1. Missing authentication
    const unauthenticated = await requestOverdue();

    assert.equal(unauthenticated.status, 401);

    // 2. Invalid JWT
    const invalidJwt = await requestOverdue({
      token: "invalid.jwt.token",
    });

    assert.equal(invalidJwt.status, 401);

    // 3. Expired database session
    const expired = await createUserToken({
      expired: true,
    });

    const expiredResponse = await requestOverdue({
      token: expired.token,
    });

    assert.equal(expiredResponse.status, 401);

    // 4. Revoked database session
    const revoked = await createUserToken({
      revoked: true,
    });

    const revokedResponse = await requestOverdue({
      token: revoked.token,
    });

    assert.equal(revokedResponse.status, 401);

    // 5. Inactive user
    const inactive = await createUserToken({
      isActive: false,
    });

    const inactiveResponse = await requestOverdue({
      token: inactive.token,
    });

    assert.equal(inactiveResponse.status, 401);

    // 6. Active Admin
    const admin = await createUserToken({
      role: "admin",
    });

    const adminResponse = await requestOverdue({
      token: admin.token,
    });

    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.body.success, true);
    assert.equal(adminResponse.body.pagination.total, 0);

    // 7. Active Staff
    const staff = await createUserToken({
      role: "staff",
    });

    const staffResponse = await requestOverdue({
      token: staff.token,
    });

    assert.equal(staffResponse.status, 200);

    // 8. Create overdue loan fixtures
    const daysAgo = (days) =>
      new Date(Date.now() - days * 86400000);

    const createLoan = async ({
      loanNumber,
      maturityDaysAgo,
      gracePeriodDays,
    }) =>
      PawnLoan.create({
        loanNumber,
        customer: newId(),
        goldItems: [newId()],
        principalAmount: 100000,
        interestRate: 2,
        issueDate: daysAgo(180),
        maturityDate: daysAgo(maturityDaysAgo),
        status: "active",
        settingsVersion: 1,
        settingsSnapshot: {
          interest: {
            rate: 2,
            calculationMethod: "monthly",
            principalCalculationMethod:
              "original_principal",
          },
          loan: {
            defaultDurationMonths: 6,
          },
          overdue: {
            gracePeriodDays,
          },
        },
        createdBy: admin.user._id,
      });

    const overdueLoan = await createLoan({
      loanNumber: "SIG-OVERDUE-HTTP-001",
      maturityDaysAgo: 15,
      gracePeriodDays: 3,
    });

    await createLoan({
      loanNumber: "SIG-OVERDUE-HTTP-002",
      maturityDaysAgo: 2,
      gracePeriodDays: 5,
    });

    // 9. Admin retrieves overdue loan
    const populatedResponse = await requestOverdue({
      token: admin.token,
    });

    assert.equal(populatedResponse.status, 200);
    assert.equal(populatedResponse.body.pagination.total, 1);

    assert.equal(
      populatedResponse.body.pawnLoans[0].loanNumber,
      "SIG-OVERDUE-HTTP-001"
    );

    assert.equal(
      populatedResponse.body.pawnLoans[0].overdueStatus,
      "overdue"
    );

    // 10. Staff retrieves same overdue loan
    const staffPopulated = await requestOverdue({
      token: staff.token,
    });

    assert.equal(staffPopulated.status, 200);
    assert.equal(staffPopulated.body.pagination.total, 1);

    // 11. Invalid pagination
    for (const query of [
      "?page=0",
      "?page=abc",
      "?limit=0",
      "?limit=101",
      "?unexpected=value",
    ]) {
      const response = await requestOverdue({
        token: admin.token,
        query,
      });

      assert.equal(response.status, 400);
    }

    // 12. Valid pagination
    const validPage = await requestOverdue({
      token: admin.token,
      query: "?page=1&limit=1",
    });

    assert.equal(validPage.status, 200);
    assert.equal(validPage.body.count, 1);
    assert.equal(validPage.body.pagination.total, 1);

    // 13. Read-only verification
    const loanAfter = await PawnLoan.findById(
      overdueLoan._id
    );

    assert.equal(loanAfter.status, "active");
    assert.equal(loanAfter.principalAmount, 100000);

    assert.equal(
      await PawnLoan.countDocuments(),
      2
    );

    console.log(
      "Overdue authenticated HTTP integration: PASSED"
    );
  } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) =>
          error ? reject(error) : resolve()
        );
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
