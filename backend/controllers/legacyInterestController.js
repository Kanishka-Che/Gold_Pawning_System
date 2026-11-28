
import mongoose from "mongoose";

import {
  getLegacyInterestPreview,
} from "../services/legacyInterestPreviewService.js";


export const previewLegacyPawnInterest = async (
  req,
  res
) => {
  let session;

  res.set("Cache-Control", "no-store");

  try {
    // 1. Validate administrator access
    if (
      !req.user?._id ||
      req.user.role !== "admin" ||
      req.user.isActive !== true
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Administrator access required",
      });
    }

    // 2. Validate pawn loan ID
    if (
      typeof req.params.id !== "string" ||
      !mongoose.isObjectIdOrHexString(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid pawn loan ID",
      });
    }

    // 3. Reject unsupported query parameters
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({
        success: false,

        message:
          "Custom calculation parameters are not supported",
      });
    }

    // Use one calculation date for the request
    const calculationDate = new Date();

    // 4. Start consistent database read
    session = await mongoose.startSession();

    let preview;

    await session.withTransaction(
      async () => {
        preview = await getLegacyInterestPreview({
          req,

          loanId: req.params.id,

          calculationDate,

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

    // 5. Return provisional calculation
    return res.status(200).json({
      success: true,

      message:
        "Legacy interest preview calculated successfully",

      preview,
    });

  } catch (error) {
    if (
      [400, 401, 403, 404, 409].includes(
        error.statusCode
      )
    ) {
      return res.status(error.statusCode).json({
        success: false,

        code:
          error.statusCode === 409
            ? "LEGACY_INTEREST_PREVIEW_CONFLICT"
            : "LEGACY_INTEREST_PREVIEW_ERROR",

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
          "Legacy loan data changed. Reload and try again.",
      });
    }

    console.error(
      "Legacy Interest Preview Error:",
      error.name,
      error.code
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to calculate legacy interest preview",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
