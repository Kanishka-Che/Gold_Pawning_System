
import mongoose from "mongoose";
import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";

const MAX_PAGE_SIZE = 100;
const MAX_PAGINATION_WINDOW = 10000;

const invalidPagination = (res) =>
  res.status(400).json({
    success: false,
    message: "Invalid pagination parameters",
  });

const isValidPositiveInteger = (value) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }

  const text = String(value);

  return /^[1-9]\d*$/.test(text) &&
    Number.isSafeInteger(Number(text));
};

// GET /api/pawn-loans/:id/payments
// Read-only payment history
export const getPawnLoanPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    // Only page and limit are accepted.
    const query = req.query ?? {};

    const allowedKeys = new Set(["page", "limit"]);

    for (const key of Object.keys(query)) {
      if (!allowedKeys.has(key)) {
        return invalidPagination(res);
      }

      if (Array.isArray(query[key])) {
        return invalidPagination(res);
      }
    }

    // Reject duplicate parameters using the raw URL.
    // This also works when Express query parsing collapses duplicates.
    const rawQuery = req.originalUrl?.split("?")[1];

    if (rawQuery !== undefined) {
      const params = new URLSearchParams(rawQuery);

      for (const key of params.keys()) {
        if (!allowedKeys.has(key)) {
          return invalidPagination(res);
        }

        if (params.getAll(key).length !== 1) {
          return invalidPagination(res);
        }
      }
    }

    const rawPage = query.page ?? "1";
    const rawLimit = query.limit ?? "20";

    if (
      !isValidPositiveInteger(rawPage) ||
      !isValidPositiveInteger(rawLimit)
    ) {
      return invalidPagination(res);
    }

    const page = Number(rawPage);
    const limit = Number(rawLimit);

    if (
      limit > MAX_PAGE_SIZE ||
      page * limit > MAX_PAGINATION_WINDOW
    ) {
      return invalidPagination(res);
    }

    const loan = await PawnLoan.findById(id)
      .select("_id loanNumber")
      .lean();

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Pawn loan not found",
      });
    }

    const filter = { pawnLoan: loan._id };

    const [payments, total, totals] = await Promise.all([
      PawnPayment.find(filter)
        .select(
          "amount interestPaid principalPaid paymentMethod paidAt recordedBy reference"
        )
        .populate("recordedBy", "username")
        .sort({ paidAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      PawnPayment.countDocuments(filter),

      PawnPayment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,

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
                    { $multiply: ["$interestPaid", 100] },
                    0,
                  ],
                },
              },
            },

            totalPrincipalPaid: {
              $sum: {
                $toLong: {
                  $round: [
                    { $multiply: ["$principalPaid", 100] },
                    0,
                  ],
                },
              },
            },
          },
        },
      ]),
    ]);

    const summary = totals[0] ?? {
      totalAmount: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
    };

    return res.status(200).json({
      success: true,
      loanNumber: loan.loanNumber,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),

      summary: {
        totalAmount: Number(
          (summary.totalAmount / 100).toFixed(2)
        ),
        totalInterestPaid: Number(
          (summary.totalInterestPaid / 100).toFixed(2)
        ),
        totalPrincipalPaid: Number(
          (summary.totalPrincipalPaid / 100).toFixed(2)
        ),
      },

      payments,
    });
  } catch (error) {
    console.error("Payment History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};
