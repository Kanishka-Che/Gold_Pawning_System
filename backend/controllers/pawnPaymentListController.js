import PawnPayment from "../models/PawnPayment.js";

const MAX_PAGE_SIZE = 100;
const MAX_PAGINATION_WINDOW = 10000;

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

const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
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
      throw validationError("Invalid query parameters");
    }
  }

  for (const key of Object.keys(req.query)) {
    if (
      !allowedKeys.includes(key) ||
      typeof req.query[key] !== "string"
    ) {
      throw validationError("Invalid query parameters");
    }
  }
};

const buildDateFilter = (
  fromDate,
  toDate,
  defaultToday = false
) => {
  if (
    fromDate === undefined &&
    toDate === undefined &&
    defaultToday
  ) {
    fromDate = getSriLankaToday();
    toDate = fromDate;
  }

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
    throw validationError("Invalid payment date range");
  }

  const start = new Date(
    `${fromDate}T00:00:00.000+05:30`
  );

  const end = new Date(
    `${toDate}T00:00:00.000+05:30`
  );

  end.setTime(end.getTime() + 86400000);

  return {
    paidAt: {
      $gte: start,
      $lt: end,
    },
  };
};

const buildFilter = (query, defaultToday = false) => {
  const filter = buildDateFilter(
    query.fromDate,
    query.toDate,
    defaultToday
  );

  if (query.paymentMethod !== undefined) {
    if (
      !["cash", "bank_transfer"].includes(
        query.paymentMethod
      )
    ) {
      throw validationError("Invalid payment method");
    }

    filter.paymentMethod = query.paymentMethod;
  }

  return filter;
};

const parsePositiveInteger = (value) => {
  if (!/^[1-9]\d*$/.test(value)) {
    throw validationError(
      "Invalid pagination parameters"
    );
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw validationError(
      "Invalid pagination parameters"
    );
  }

  return number;
};

// GET /api/pawn-payments
export const getPawnPayments = async (req, res) => {
  try {
    validateQuery(req, [
      "page",
      "limit",
      "fromDate",
      "toDate",
      "paymentMethod",
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

    const filter = buildFilter(req.query);

    const [payments, total] = await Promise.all([
      PawnPayment.find(filter)
        .select(
          "pawnLoan amount interestPaid principalPaid " +
          "paymentMethod paidAt recordedBy reference"
        )
        .populate({
          path: "pawnLoan",
          select: "loanNumber customer status",
          populate: {
            path: "customer",
            select: "customerCode fullName",
          },
        })
        .populate("recordedBy", "username")
        .sort({ paidAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      PawnPayment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      payments,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Get Pawn Payments Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load payment records",
    });
  }
};

// GET /api/pawn-payments/summary
export const getPawnPaymentSummary = async (
  req,
  res
) => {
  try {
    validateQuery(req, [
      "fromDate",
      "toDate",
      "paymentMethod",
    ]);

    const filter = buildFilter(req.query, true);

    const results = await PawnPayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,

          paymentCount: { $sum: 1 },

          totalAmount: {
            $sum: {
              $toLong: {
                $round: [
                  { $multiply: ["$amount", 100] },
                  0,
                ],
              },
            },
          },

          totalInterestPaid: {
            $sum: {
              $toLong: {
                $round: [
                  {
                    $multiply: [
                      "$interestPaid",
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },

          totalPrincipalPaid: {
            $sum: {
              $toLong: {
                $round: [
                  {
                    $multiply: [
                      "$principalPaid",
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      },
    ]);

    const summary = results[0] ?? {
      paymentCount: 0,
      totalAmount: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
    };

    const formatMoney = (value) => {
      const cents = BigInt(value.toString());

      if (
        cents < 0n ||
        cents > BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        throw new Error(
          "Payment summary exceeds safe monetary range"
        );
      }

      return Number(cents) / 100;
    };

    return res.status(200).json({
      success: true,

      fromDate:
        req.query.fromDate ?? getSriLankaToday(),

      toDate:
        req.query.toDate ?? getSriLankaToday(),

      summary: {
        paymentCount: summary.paymentCount,

        totalAmount: formatMoney(
          summary.totalAmount
        ),

        totalInterestPaid: formatMoney(
          summary.totalInterestPaid
        ),

        totalPrincipalPaid: formatMoney(
          summary.totalPrincipalPaid
        ),
      },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Get Payment Summary Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load payment summary",
    });
  }
};