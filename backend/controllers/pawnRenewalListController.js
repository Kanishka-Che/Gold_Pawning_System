import PawnLoanRenewal from "../models/PawnLoanRenewal.js";

const MAX_PAGE_SIZE = 100;
const MAX_PAGINATION_WINDOW = 10000;
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

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

const isValidDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const validateQuery = (req, allowedKeys) => {
  const params = new URLSearchParams(
    req.originalUrl.split("?")[1] || ""
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
      "Invalid renewal date range"
    );
  }

  const start = new Date(
    `${fromDate}T00:00:00.000+05:30`
  );

  const end = new Date(
    `${toDate}T00:00:00.000+05:30`
  );

  end.setTime(end.getTime() + 86400000);

  return {
    renewedAt: {
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

// GET /api/pawn-renewals
export const getPawnRenewals = async (req, res) => {
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

    const [renewals, total] = await Promise.all([
      PawnLoanRenewal.find(filter)
        .select(
          "pawnLoan previousMaturityDate " +
          "newMaturityDate renewedAt renewedBy " +
          "settingsVersion interestSettled " +
          "renewalFeePaid notes"
        )
        .populate({
          path: "pawnLoan",
          select: "loanNumber customer status",
          populate: {
            path: "customer",
            select: "customerCode fullName",
          },
        })
        .populate("renewedBy", "username")
        .sort({
          renewedAt: -1,
          _id: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      PawnLoanRenewal.countDocuments(filter),
    ]);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      renewals,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load renewal records"
    );
  }
};

// Convert stored monetary amounts to decimal cents
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

const readCents = (value) => {
  const text = value.toString();

  if (!/^\d+(\.0+)?$/.test(text)) {
    throw new Error(
      "Invalid renewal summary amount"
    );
  }

  const cents = BigInt(text.split(".")[0]);

  if (cents > MAX_CENTS) {
    throw new Error(
      "Renewal summary exceeds safe monetary range"
    );
  }

  return cents;
};

const formatMoney = (cents) => {
  if (cents < 0n || cents > MAX_CENTS) {
    throw new Error(
      "Renewal summary exceeds safe monetary range"
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

// GET /api/pawn-renewals/summary
export const getPawnRenewalSummary = async (
  req,
  res
) => {
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

    const [results, todayCount, monthCount] =
      await Promise.all([
        PawnLoanRenewal.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,

              renewalCount: {
                $sum: 1,
              },

              totalInterestSettled:
                sumMoney("$interestSettled"),

              totalRenewalFees:
                sumMoney("$renewalFeePaid"),
            },
          },
        ]),

        PawnLoanRenewal.countDocuments(
          todayFilter
        ),

        PawnLoanRenewal.countDocuments(
          monthFilter
        ),
      ]);

    const summary = results[0] ?? {
      renewalCount: 0,
      totalInterestSettled: 0,
      totalRenewalFees: 0,
    };

    const interestCents = readCents(
      summary.totalInterestSettled
    );

    const feeCents = readCents(
      summary.totalRenewalFees
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      fromDate,
      toDate,

      today,
      monthStart,

      summary: {
        todayRenewalCount: todayCount,

        monthlyRenewalCount: monthCount,

        renewalCount: summary.renewalCount,

        totalInterestSettled:
          formatMoney(interestCents),

        totalRenewalFees:
          formatMoney(feeCents),

        totalCollected:
          formatMoney(
            interestCents + feeCents
          ),
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load renewal summary"
    );
  }
};