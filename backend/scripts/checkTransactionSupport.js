
import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  const admin = mongoose.connection.db.admin();
  const hello = await admin.command({ hello: 1 });

  const isReplicaSet = Boolean(hello.setName);
  const isSharded = hello.msg === "isdbgrid";

  console.log("MongoDB deployment:");
  console.log("Replica set:", isReplicaSet);
  console.log("Sharded cluster:", isSharded);

  if (!isReplicaSet && !isSharded) {
    throw new Error(
      "MongoDB transactions require a replica set or sharded cluster"
    );
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await mongoose.connection.db
        .collection("__transaction_check")
        .findOne(
          { _id: "transaction-test" },
          { session }
        );
    });

    console.log("Transaction test: PASSED");
  } finally {
    await session.endSession();
  }
}

main()
  .catch((error) => {
    console.error("Transaction test: FAILED");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
