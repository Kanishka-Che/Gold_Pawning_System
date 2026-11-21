
import "dotenv/config";
import mongoose from "mongoose";
import PawnPayment from "../models/PawnPayment.js";

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  // Explicitly create declared indexes.
  await PawnPayment.createIndexes();

  const indexes = await PawnPayment.collection.indexes();

  const index = indexes.find(
    (item) =>
      item.name ===
      "unique_pawn_payment_idempotency_key"
  );

  if (!index) {
    throw new Error("Idempotency index not found");
  }

  if (
    index.unique !== true ||
    index.key?.idempotencyKey !== 1
  ) {
    throw new Error(
      "Idempotency index is not configured correctly"
    );
  }

  console.log("Payment idempotency index: FOUND");
  console.log("Unique constraint: ENABLED");
  console.log("Index verification: PASSED");
}

main()
  .catch((error) => {
    console.error(
      "Index verification: FAILED",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
