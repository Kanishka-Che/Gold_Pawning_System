
import "dotenv/config";
import mongoose from "mongoose";

async function initializeReplicaSet() {
  try {
    // Connect directly to the local MongoDB server.
    await mongoose.connect(
      "mongodb://127.0.0.1:27017/admin?directConnection=true",
      {
        serverSelectionTimeoutMS: 5000,
      }
    );

    console.log("Connected to local MongoDB");

    const admin = mongoose.connection.db.admin();

    const hello = await admin.command({ hello: 1 });

    if (hello.setName) {
      console.log(
        "Replica Set already initialized:",
        hello.setName
      );
      return;
    }

    const result = await admin.command({
      replSetInitiate: {
        _id: "rs0",
        members: [
          {
            _id: 0,
            host: "127.0.0.1:27017",
          },
        ],
      },
    });

    console.log("Initialization result:", result);
    console.log("Replica Set initialization requested");
  } catch (error) {
    console.error(
      "Replica Set initialization failed:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

initializeReplicaSet();
