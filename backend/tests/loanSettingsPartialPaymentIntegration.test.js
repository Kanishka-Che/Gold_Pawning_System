
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import LoanSettings from "../models/LoanSettings.js";
import AuditLog from "../models/AuditLog.js";

import {
  updateLoanSettings,
} from "../controllers/loanSettingsController.js";

test("Admin partial payment settings MongoDB integration", async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  // Use a separate database, never the application database.
  const testDbName =
    `sigiri_settings_test_${randomUUID().replaceAll("-", "")}`;

  const testUri = new URL(mongoUri);
  testUri.pathname = `/${testDbName}`;
  testUri.searchParams.delete("authSource");

  let connected = false;

  try {
    await mongoose.connect(testUri.toString());
    connected = true;

    const adminId = new mongoose.Types.ObjectId();

   const req = {
  body: {
    expectedVersion: 1,

    partialPayment: {
      enabled: true,
      allowPartialInterest: true,
      allowPartialPrincipal: false,
    },
  },

  user: {
    _id: adminId,
    role: "admin",
    isActive: true,
  },

  ip: "127.0.0.1",
  get: () => "Sigiri Integration Test",
};

    const createResponse = () => ({
      statusCode: 200,
      body: null,

      status(code) {
        this.statusCode = code;
        return this;
      },

      json(data) {
        this.body = data;
        return this;
      },
    });

    // First settings update
    const firstResponse = createResponse();

    await updateLoanSettings(req, firstResponse);

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.body.success, true);

    const settings = await LoanSettings.findOne({
      settingsKey: "default",
    });

    assert.ok(settings);
    assert.equal(settings.partialPayment.enabled, true);
    assert.equal(
      settings.partialPayment.allowPartialInterest,
      true
    );
    assert.equal(
      settings.partialPayment.allowPartialPrincipal,
      false
    );
    assert.equal(settings.version, 2);

    console.log("Partial payment settings saved: PASSED");
    console.log("Settings version incremented: PASSED");

    const auditLogs = await AuditLog.find({
      action: "LOAN_SETTINGS_UPDATED",
      targetId: settings._id,
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(
      auditLogs[0].details.newVersion,
      2
    );

    console.log("Settings audit log created: PASSED");

    // Repeating the same settings should not create a change.
   // Repeating the same settings should not create a change.
const secondResponse = createResponse();

const retryReq = {
  ...req,
  body: {
    ...req.body,
    expectedVersion: 2,
  },
};

await updateLoanSettings(retryReq, secondResponse);

    assert.equal(secondResponse.statusCode, 200);

    const settingsAfterRetry =
      await LoanSettings.findOne({
        settingsKey: "default",
      });

    assert.equal(settingsAfterRetry.version, 2);

    const auditCount = await AuditLog.countDocuments({
      action: "LOAN_SETTINGS_UPDATED",
      targetId: settings._id,
    });

    assert.equal(auditCount, 1);

    console.log("Unchanged settings do not create audit: PASSED");

    // Reject an update based on an outdated settings version.
    const staleResponse = createResponse();

    const staleReq = {
      ...req,
      body: {
        expectedVersion: 1,
        partialPayment: {
          enabled: false,
        },
      },
    };

    await updateLoanSettings(staleReq, staleResponse);

    assert.equal(staleResponse.statusCode, 409);

    const settingsAfterConflict =
      await LoanSettings.findOne({
        settingsKey: "default",
      });

    assert.equal(settingsAfterConflict.version, 2);
    assert.equal(
      settingsAfterConflict.partialPayment.enabled,
      true
    );

    const auditCountAfterConflict =
      await AuditLog.countDocuments({
        action: "LOAN_SETTINGS_UPDATED",
        targetId: settings._id,
      });

    assert.equal(auditCountAfterConflict, 1);

    console.log("Stale settings version rejected: PASSED");
    console.log("Settings unchanged after conflict: PASSED");

  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
    }

    await mongoose.disconnect();
  }
});
