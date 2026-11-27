import PawnLoanRedemption from
  "../models/PawnLoanRedemption.js";

const MAX_PAGE_SIZE = 100;

const MAX_PAGINATION_WINDOW = 10000;

const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

// Sri Lanka current calendar date
const getSriLankaToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const validationError = (message) => {
  const error = new Error(message);

  error.statusCode = 400;

  return error;
};

// Validate YYYY-MM-DD date
const isValidDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

// Reject unknown and duplicate query parameters
const validateQuery = (req, allowedKeys) => {
  const queryIndex = req.originalUrl.indexOf("?");

  const params = new URLSearchParams(
    queryIndex === -1
      ? ""
      : req.originalUrl.slice(queryIndex + 1)
  );

  for (const key of params.keys()) {
    if (
      !allowedKeys.includes(key) ||
      params.getAll(key).length !== 1
    ) {
      throw validationError(
        "Invalid query parameters"
      );
    }
  }

  for (const key of Object.keys(req.query ?? {})) {
    if (
      !allowedKeys.includes(key) ||
      typeof req.query[key] !== "string"
    ) {
      throw validationError(
        "Invalid query parameters"
      );
    }
  }
};

const parsePositiveInteger = (value) => {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw validationError(
      "Invalid pagination parameters"
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw validationError(
      "Invalid pagination parameters"
    );
  }

  return parsed;
};

// Build Sri Lanka date range
const buildDateFilter = (fromDate, toDate) => {
  if (
    fromDate === undefined &&
    toDate === undefined
  ) {
    return {};
  }

  if (
    !isValidDate(fromDate) ||
    !isValidDate(toDate) ||
    fromDate > toDate
  ) {
    throw validationError(
      "Invalid redemption date range"
    );
  }

  const start = new Date(
    `${fromDate}T00:00:00.000+05:30`
  );

  const end = new Date(
    `${toDate}T00:00:00.000+05:30`
  );

  end.setTime(
    end.getTime() + 86400000
  );

  return {
    redeemedAt: {
      $gte: start,
      $lt: end,
    },
  };
};

const handleError = (res, error, message) => {
  if (error.statusCode === 400) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(message, error);

  return res.status(500).json({
    success: false,
    message,
  });
};

// GET /api/pawn-redemptions

export const getPawnRedemptions = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    validateQuery(req, [
      "page",
      "limit",
      "fromDate",
      "toDate",
    ]);

    const page = parsePositiveInteger(
      req.query.page ?? "1"
    );

    const limit = parsePositiveInteger(
      req.query.limit ?? "20"
    );

    if (
      limit > MAX_PAGE_SIZE ||
      page * limit > MAX_PAGINATION_WINDOW
    ) {
      throw validationError(
        "Invalid pagination parameters"
      );
    }

    const filter = buildDateFilter(
      req.query.fromDate,
      req.query.toDate
    );

    const [redemptions, total] =
      await Promise.all([
        PawnLoanRedemption.find(filter)
          .select(
            "pawnLoan redeemedAt redeemedBy " +
            "settingsVersion principalSettled " +
            "interestSettled penaltySettled " +
            "totalSettled releasedGoldItems notes"
          )
          .populate({
            path: "pawnLoan",
            select: "loanNumber customer status",
            populate: {
              path: "customer",
              select: "customerCode fullName",
            },
          })
          .populate(
            "redeemedBy",
            "username"
          )
          .sort({
            redeemedAt: -1,
            _id: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),

        PawnLoanRedemption.countDocuments(
          filter
        ),
      ]);

    return res.status(200).json({
      success: true,

      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),

      redemptions,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load redemption records"
    );
  }
};

// Convert stored monetary values to decimal cents
const sumMoney = (field) => ({
  $sum: {
    $toDecimal: {
      $round: [
        {
          $multiply: [
            { $toDecimal: field },
            100,
          ],
        },
        0,
      ],
    },
  },
});

// Safely read decimal cents
const readCents = (value) => {
  const text = value.toString();

  if (!/^\d+(\.0+)?$/.test(text)) {
    throw new Error(
      "Invalid redemption summary amount"
    );
  }

  const cents = BigInt(
    text.split(".")[0]
  );

  if (
    cents < 0n ||
    cents > MAX_CENTS
  ) {
    throw new Error(
      "Redemption summary exceeds safe monetary range"
    );
  }

  return cents;
};

// Convert cents to a two-decimal monetary string
const formatMoney = (cents) => {
  if (
    cents < 0n ||
    cents > MAX_CENTS
  ) {
    throw new Error(
      "Redemption summary exceeds safe monetary range"
    );
  }

  return (
    (cents / 100n).toString() +
    "." +
    (cents % 100n)
      .toString()
      .padStart(2, "0")
  );
};

// GET /api/pawn-redemptions/summary

export const getPawnRedemptionSummary = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    validateQuery(req, [
      "fromDate",
      "toDate",
    ]);

    const today = getSriLankaToday();

    const monthStart =
      today.slice(0, 7) + "-01";

    let fromDate = req.query.fromDate;

    let toDate = req.query.toDate;

    // Default selected date range is today.
    if (
      fromDate === undefined &&
      toDate === undefined
    ) {
      fromDate = today;
      toDate = today;
    }

    const filter = buildDateFilter(
      fromDate,
      toDate
    );

    const todayFilter = buildDateFilter(
      today,
      today
    );

    const monthFilter = buildDateFilter(
      monthStart,
      today
    );

    const [
      results,
      todayCount,
      monthCount,
    ] = await Promise.all([
      PawnLoanRedemption.aggregate([
        {
          $match: filter,
        },

        {
          $group: {
            _id: null,

            redemptionCount: {
              $sum: 1,
            },

            totalPrincipalSettled:
              sumMoney("$principalSettled"),

            totalInterestSettled:
              sumMoney("$interestSettled"),

            totalPenaltySettled:
              sumMoney("$penaltySettled"),

            totalSettled:
              sumMoney("$totalSettled"),
          },
        },
      ]),

      PawnLoanRedemption.countDocuments(
        todayFilter
      ),

      PawnLoanRedemption.countDocuments(
        monthFilter
      ),
    ]);

    const summary = results[0] ?? {
      redemptionCount: 0,

      totalPrincipalSettled: 0,

      totalInterestSettled: 0,

      totalPenaltySettled: 0,

      totalSettled: 0,
    };

    const principalCents = readCents(
      summary.totalPrincipalSettled
    );

    const interestCents = readCents(
      summary.totalInterestSettled
    );

    const penaltyCents = readCents(
      summary.totalPenaltySettled
    );

    const recordedTotalCents = readCents(
      summary.totalSettled
    );

    const calculatedTotalCents =
      principalCents +
      interestCents +
      penaltyCents;

    // Validate aggregate settlement consistency.
    if (
      calculatedTotalCents !==
      recordedTotalCents
    ) {
      throw new Error(
        "Redemption settlement totals are inconsistent"
      );
    }

    return res.status(200).json({
      success: true,

      currency: "LKR",

      fromDate,

      toDate,

      today,

      monthStart,

      summary: {
        todayRedemptionCount:
          todayCount,

        monthlyRedemptionCount:
          monthCount,

        redemptionCount:
          summary.redemptionCount,

        totalPrincipalSettled:
          formatMoney(principalCents),

        totalInterestSettled:
          formatMoney(interestCents),

        totalPenaltySettled:
          formatMoney(penaltyCents),

        totalCollected:
          formatMoney(recordedTotalCents),
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load redemption summary"
    );
  }
};