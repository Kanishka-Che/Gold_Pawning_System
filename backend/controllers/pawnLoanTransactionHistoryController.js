
import mongoose from "mongoose";

import {
  getCombinedTransactionHistory,
} from "../services/combinedTransactionHistoryService.js";


const parsePositiveInteger = (
  value,
  fallback
) => {
  if (value === undefined) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed)
    ? parsed
    : null;
};


// GET /api/pawn-loans/:id/transactions
export const getPawnLoanTransactionHistory = async (
  req,
  res
) => {
  let session;

  res.set("Cache-Control", "no-store");

  try {
    // 1. Authentication
    if (
      !req.user?._id ||
      !mongoose.isObjectIdOrHexString(
        req.user._id
      )
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    // 2. Authorization
    if (
      !["admin", "staff"].includes(
        req.user.role
      ) ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "Transaction history access denied",
      });
    }

    // 3. Validate loan ID
    const pawnLoanId = req.params?.id;

    if (
      typeof pawnLoanId !== "string" ||
      !mongoose.isObjectIdOrHexString(
        pawnLoanId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    // 4. Validate query parameters
    const query = req.query ?? {};

    const allowedKeys = new Set([
      "page",
      "limit",
    ]);

    if (
      typeof query !== "object" ||
      Array.isArray(query) ||
      Object.keys(query).some(
        (key) => !allowedKeys.has(key)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    // Reject duplicate raw query parameters
    const rawQuery =
      req.originalUrl?.split("?")[1];

    if (rawQuery !== undefined) {
      const params =
        new URLSearchParams(rawQuery);

      for (const key of params.keys()) {
        if (
          !allowedKeys.has(key) ||
          params.getAll(key).length !== 1
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid pagination parameters",
          });
        }
      }
    }

    const page = parsePositiveInteger(
      query.page,
      1
    );

    const limit = parsePositiveInteger(
      query.limit,
      20
    );

    if (
      page === null ||
      limit === null ||
      limit > 100 ||
      !Number.isSafeInteger(page * limit) ||
      page * limit > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    // 5. Start consistent database read
    session = await mongoose.startSession();

    let history;

    await session.withTransaction(
      async () => {
        history =
          await getCombinedTransactionHistory({
            req,

            loanId: pawnLoanId,

            page,

            limit,

            session,
          });
      },
      {
        readConcern: {
          level: "snapshot",
        },

        readPreference: "primary",
      }
    );

    // 6. Return combined transaction history
    return res.status(200).json({
      success: true,

      ...history,
    });

  } catch (error) {
    if (
      [400, 401, 403, 404, 409].includes(
        error.statusCode
      )
    ) {
      return res.status(error.statusCode).json({
        success: false,

        message: error.message,
      });
    }

    if (
      error.code === 112 ||
      error.hasErrorLabel?.(
        "TransientTransactionError"
      )
    ) {
      return res.status(409).json({
        success: false,

        message:
          "Transaction history changed. Reload and try again.",
      });
    }

    console.error(
      "Get Combined Transaction History Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to retrieve transaction history",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
