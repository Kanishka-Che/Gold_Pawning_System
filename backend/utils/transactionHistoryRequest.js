
import mongoose from "mongoose";

const requestError = (message, statusCode) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

export const validateTransactionHistoryRequest = (
  req
) => {
  if (
    !req.user?._id ||
    !mongoose.isObjectIdOrHexString(req.user._id)
  ) {
    throw requestError("Not authorized", 401);
  }

  if (
    !["admin", "staff"].includes(req.user.role) ||
    req.user.isActive !== true
  ) {
    throw requestError(
      "Transaction history access denied",
      403
    );
  }

  const loanId = req.params?.id;

  if (
    typeof loanId !== "string" ||
    !mongoose.isObjectIdOrHexString(loanId)
  ) {
    throw requestError("Invalid pawn loan ID", 400);
  }

  const query = req.query ?? {};

  const allowedKeys = new Set(["page", "limit"]);

  if (
    typeof query !== "object" ||
    Array.isArray(query) ||
    Object.keys(query).some(
      (key) => !allowedKeys.has(key)
    )
  ) {
    throw requestError(
      "Invalid pagination parameters",
      400
    );
  }

  const rawQuery = req.originalUrl?.split("?")[1];

  if (rawQuery !== undefined) {
    const params = new URLSearchParams(rawQuery);

    for (const key of params.keys()) {
      if (
        !allowedKeys.has(key) ||
        params.getAll(key).length !== 1
      ) {
        throw requestError(
          "Invalid pagination parameters",
          400
        );
      }
    }
  }

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

  const page = parsePositiveInteger(query.page, 1);

  const limit = parsePositiveInteger(query.limit, 20);

  if (
    page === null ||
    limit === null ||
    limit > 100 ||
    !Number.isSafeInteger(page * limit) ||
    page * limit > 10000
  ) {
    throw requestError(
      "Invalid pagination parameters",
      400
    );
  }

  return {
    loanId,
    page,
    limit,
  };
};
