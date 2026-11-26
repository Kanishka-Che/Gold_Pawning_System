
import "dotenv/config";
import mongoose from "mongoose";
import GoldItem from "../models/GoldItem.js";
import Counter from "../models/Counter.js";
import connectDB from "../config/db.js";

const migrateGoldItemCodes = async () => {
  try {
    await connectDB();

    console.log("Connected to MongoDB");

    const itemsWithoutCodes = await GoldItem.countDocuments({
      $or: [
        { goldItemCode: { $exists: false } },
        { goldItemCode: null },
      ],
    });

    const itemsWithCodes = await GoldItem.countDocuments({
      goldItemCode: { $type: "string" },
    });

    const counter = await Counter.findById("goldItemCode");

    console.log("=== GOLD ITEM MIGRATION PREVIEW ===");
    console.log("Items without codes:", itemsWithoutCodes);
    console.log("Items with codes:", itemsWithCodes);
    console.log("Current counter:", counter?.sequence ?? "Not found");
    console.log("No database records were modified.");
  } catch (error) {
    console.error("Migration preview failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

migrateGoldItemCodes();
