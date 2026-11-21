
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import {
  withPaymentTransaction,
} from "../services/paymentTransactionService.js";

test(
  "Payment transaction helper commits and rolls back correctly",
  async () => {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    const dbName =
      `sigiri_tx_service_test_${randomUUID().replaceAll("-", "")}`;

    // Use the isolated test database with the default
    // Mongoose connection used by the helper.
    const uri = new URL(process.env.MONGO_URI);
    uri.pathname = `/${dbName}`;

    await mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 5000,
    });

    try {
      const collection = mongoose.connection.db.collection(
        "transaction_test_records"
      );

      // Test 1: Successful transaction should commit.
      await withPaymentTransaction(async (session) => {
        await collection.insertOne(
          { name: "committed" },
          { session }
        );
      });

      const committed = await collection.countDocuments({
        name: "committed",
      });

      assert.equal(committed, 1);

      // Test 2: Failed transaction should roll back.
      await assert.rejects(
        () =>
          withPaymentTransaction(async (session) => {
            await collection.insertOne(
              { name: "rolled_back" },
              { session }
            );

            throw new Error("Simulated failure");
          }),
        /Simulated failure/
      );

      const rolledBack = await collection.countDocuments({
        name: "rolled_back",
      });

      assert.equal(rolledBack, 0);

      console.log("Transaction commit: PASSED");
      console.log("Transaction rollback: PASSED");
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
