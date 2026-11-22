
import mongoose from "mongoose";
import GoldItem from "../models/GoldItem.js";
import { createAuditLog } from "../utils/auditLogger.js";

const editableFields = [
  "itemType",
  "description",
  "karat",
  "grossWeight",
  "deductionWeight",
];

const isValidBody = (body) =>
  body &&
  typeof body === "object" &&
  !Array.isArray(body);

const isValidationError = (error) =>
  error.name === "ValidationError" ||
  error.name === "CastError";

// POST /api/gold-items

export const createGoldItem = async (req, res) => {
  console.log("=== GOLD ITEM CREATE REQUEST ===");
  console.log("Request Body:", req.body);
  console.log("Logged In User:", req.user?._id);

  if (!isValidBody(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid gold item data",
    });
  }


  const fields = Object.keys(req.body);

  if (
    fields.length === 0 ||
    fields.some((field) => !editableFields.includes(field))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid gold item fields",
    });
  }

  const session = await mongoose.startSession();

  try {
    let goldItem;

    await session.withTransaction(async () => {
      const [createdItem] = await GoldItem.create(
        [
          {
            ...req.body,
            createdBy: req.user._id,
            status: "draft",
          },
        ],
        { session }
      );

      goldItem = createdItem;

      await createAuditLog({
        req,
        action: "GOLD_ITEM_CREATED",
        targetType: "GoldItem",
        targetId: goldItem._id,
        details: {
          itemType: goldItem.itemType,
          karat: goldItem.karat,
          grossWeight: goldItem.grossWeight,
          deductionWeight: goldItem.deductionWeight,
          netWeight: goldItem.netWeight,
          status: goldItem.status,
        },
        session,
      });
    });

    return res.status(201).json({
      success: true,
      message: "Gold item created successfully",
      goldItem,
    });
  

} catch (error) {
  console.error("Gold Item Creation Error:", error);

  if (isValidationError(error)) {
    return res.status(400).json({
      success: false,
      message: "Invalid gold item data",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Failed to create gold item",
  });
} finally {
  await session.endSession();
}

};

// GET /api/gold-items
export const getGoldItems = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};

    if (req.query.status !== undefined) {
      if (
        !["draft", "pledged", "released"].includes(
          req.query.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid gold item status",
        });
      }

      filter.status = req.query.status;
    }

    const [goldItems, total] = await Promise.all([
      GoldItem.find(filter)
        .populate("createdBy", "username")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      GoldItem.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      goldItems,
    });
  } catch (error) {
    console.error("Get Gold Items Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch gold items",
    });
  }
};

// GET /api/gold-items/:id
export const getGoldItemById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gold item ID",
      });
    }

    const goldItem = await GoldItem.findById(req.params.id)
      .populate("createdBy", "username");

    if (!goldItem) {
      return res.status(404).json({
        success: false,
        message: "Gold item not found",
      });
    }

    return res.status(200).json({
      success: true,
      goldItem,
    });
  } catch (error) {
    console.error("Get Gold Item Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch gold item",
    });
  }
};

// PATCH /api/gold-items/:id
export const updateGoldItem = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid gold item ID",
    });
  }

  if (!isValidBody(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid update data",
    });
  }

  const fields = Object.keys(req.body);

  if (
    fields.length === 0 ||
    fields.some((field) => !editableFields.includes(field))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid gold item update fields",
    });
  }

  const session = await mongoose.startSession();

  try {
    let updatedItem;
let notFound = false;
let notDraft = false;
let isReserved = false;
    

    await session.withTransaction(async () => {
      const goldItem = await GoldItem.findById(
        req.params.id
      ).session(session);

      if (!goldItem) {
        notFound = true;
        return;
      }

      if (goldItem.status !== "draft") {
        notDraft = true;
        return;
      }

       if (goldItem.reservedForLoan != null) {
    isReserved = true;
    return;
  }

      const previousValues = {};

      for (const field of fields) {
        previousValues[field] = goldItem[field];
        goldItem[field] = req.body[field];
      }

      await goldItem.save({ session });

      updatedItem = goldItem;

      const changes = {};

      for (const field of fields) {
        if (
          !Object.is(
            previousValues[field],
            goldItem[field]
          )
        ) {
          changes[field] = {
            old: previousValues[field] ?? null,
            new: goldItem[field] ?? null,
          };
        }
      }

      if (
        Object.keys(changes).length > 0
      ) {
        await createAuditLog({
          req,
          action: "GOLD_ITEM_UPDATED",
          targetType: "GoldItem",
          targetId: goldItem._id,
          details: {
            changes,
            netWeight: goldItem.netWeight,
          },
          session,
        });
      }
    });

    if (notFound) {
      return res.status(404).json({
        success: false,
        message: "Gold item not found",
      });
    }

    if (notDraft) {
      return res.status(403).json({
        success: false,
        message: "Only draft gold items can be updated",
      });
    }

    if (isReserved) {
  return res.status(409).json({
    success: false,
    message:
      "This gold item is reserved for a pawn loan and cannot be edited",
  });
}

    return res.status(200).json({
      success: true,
      message: "Gold item updated successfully",
      goldItem: updatedItem,
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gold item data",
      });
    }

    if (
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Gold item was modified concurrently. Please reload and try again.",
      });
    }

    console.error("Update Gold Item Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update gold item",
    });
  } finally {
    await session.endSession();
  }
};
