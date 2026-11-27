import mongoose from "mongoose";

import PawnLoan from "../models/PawnLoan.js";
import PawnPayment from "../models/PawnPayment.js";

import {
  calculateOverdueStatus,
} from "../utils/overdueCalculator.js";

import {
  calculateOutstandingPrincipal,
} from "../utils/outstandingBalance.js";

import {
  buildOverduePenaltyPreview,
} from "../utils/overduePenaltyPreview.js";

const UPCOMING_DAYS = 7;
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

const CLASSIFICATIONS = [
  "current",
  "due_today",
  "upcoming_due",
  "grace_period",
  "overdue",
  "unclassified",
];

const LOAN_FIELDS =
  "_id loanNumber customer principalAmount " +
  "currency issueDate maturityDate status " +
  "settingsVersion settingsSnapshot.overdue";

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
      throw validationError(
        "Invalid query parameters"
      );
    }
  }

  for (const [key, value] of Object.entries(
    req.query ?? {}
  )) {
    if (
      !allowedKeys.includes(key) ||
      typeof value !== "string"
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

const toCents = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d+\.\d{2}$/.test(value)
  ) {
    throw new Error("Invalid monetary amount");
  }

  const [whole, fraction] = value.split(".");

  const cents =
    BigInt(whole) * 100n + BigInt(fraction);

  if (cents > MAX_CENTS) {
    throw new Error(
      "Monetary amount exceeds safe range"
    );
  }

  return cents;
};

const formatMoney = (cents) => {
  if (cents < 0n || cents > MAX_CENTS) {
    throw new Error(
      "Monetary amount exceeds safe range"
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

const classifyLoan = (loan, calculationDate) => {
  try {
    return {
      ...calculateOverdueStatus({
        loan,
        calculationDate,
        upcomingDays: UPCOMING_DAYS,
      }),

      classificationError: null,
    };
  } catch (error) {
    return {
      loanStatus: loan.status,
      overdueStatus: null,
      classification: "unclassified",

      daysOverdue: null,
      daysUntilMaturity: null,
      gracePeriodDays: null,
      daysAfterGrace: null,
      remainingGraceDays: null,

      isDueToday: false,
      isUpcomingDue: false,
      isOverdue: false,

      classificationError: error.message,
    };
  }
};

const getPrincipalBalance = async (
  loan,
  session
) => {
  const payments = await PawnPayment.find({
    pawnLoan: loan._id,
  })
    .select("principalPaid")
    .session(session)
    .lean();

  try {
    return {
      balance: calculateOutstandingPrincipal({
        originalPrincipal: loan.principalAmount,
        payments,
      }),
      balanceError: null,
    };
  } catch (error) {
    return {
      balance: null,
      balanceError: error.message,
    };
  }
};

const buildLoanRecord = async ({
  loan,
  classification,
  session,
}) => {
  const {
  balance,
  balanceError,
} = await getPrincipalBalance(
  loan,
  session
);

  

  return {
    _id: loan._id,
    loanNumber: loan.loanNumber,
    customer: loan.customer,

    currency: loan.currency,
    principalAmount: loan.principalAmount,

    issueDate: loan.issueDate,
    maturityDate: loan.maturityDate,
    status: loan.status,

    settingsVersion: loan.settingsVersion,

    ...classification,

    balance,
    balanceError,

    penalty: buildOverduePenaltyPreview({
  loan,
  classification,
  balance,
}),
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

const withReadSnapshot = async (callback) => {
  const session = await mongoose.startSession();

  let result;

  try {
    await session.withTransaction(
      async () => {
        result = await callback(session);
      },
      {
        readConcern: {
          level: "snapshot",
        },
        readPreference: "primary",
      }
    );

    return result;
  } finally {
    await session.endSession();
  }
};

// GET /api/pawn-overdue
export const getPawnOverdueRecords = async (
  req,
  res
) => {
  try {
    validateQuery(req, [
      "page",
      "limit",
      "classification",
      "search",
    ]);

    const page = parsePositiveInteger(
      req.query.page ?? "1"
    );

    const limit = parsePositiveInteger(
      req.query.limit ?? "20"
    );

    if (
      limit > 100 ||
      page * limit > 10000
    ) {
      throw validationError(
        "Invalid pagination parameters"
      );
    }

    const selectedClassification =
      req.query.classification ?? "all";

    if (
      selectedClassification !== "all" &&
      !CLASSIFICATIONS.includes(
        selectedClassification
      )
    ) {
      throw validationError(
        "Invalid loan classification"
      );
    }

    const search =
      (req.query.search ?? "").trim();

    if (search.length > 100) {
      throw validationError(
        "Search must not exceed 100 characters"
      );
    }

    const normalizedSearch =
      search.toLowerCase();

    const calculationDate = new Date();

    const result = await withReadSnapshot(
      async (session) => {
        const cursor = PawnLoan.find({
          status: "active",
        })
          .select(LOAN_FIELDS)
          .populate(
            "customer",
            "customerCode fullName nic"
          )
          .sort({
            maturityDate: 1,
            _id: 1,
          })
          .session(session)
          .lean()
          .cursor({ batchSize: 200 });

        const pawnLoans = [];

        let total = 0;

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        try {
          for await (const loan of cursor) {
            const classification = classifyLoan(
              loan,
              calculationDate
            );

            if (
              selectedClassification !== "all" &&
              classification.classification !==
                selectedClassification
            ) {
              continue;
            }

            if (normalizedSearch) {
              const searchableValues = [
                loan.loanNumber,
                loan.customer?.customerCode,
                loan.customer?.fullName,
                loan.customer?.nic,
              ];

              const matches = searchableValues.some(
                (value) =>
                  String(value ?? "")
                    .toLowerCase()
                    .includes(normalizedSearch)
              );

              if (!matches) continue;
            }

            if (
              total >= startIndex &&
              total < endIndex
            ) {
              pawnLoans.push(
                await buildLoanRecord({
                  loan,
                  classification,
                  session,
                })
              );
            }

            total += 1;
          }
        } finally {
          await cursor.close();
        }

        return {
          pawnLoans,
          total,
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      calculationDate,
      upcomingDays: UPCOMING_DAYS,

      classification: selectedClassification,

      page,
      limit,

      total: result.total,

      totalPages: Math.ceil(
        result.total / limit
      ),

      pawnLoans: result.pawnLoans,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load overdue management records"
    );
  }
};

// GET /api/pawn-overdue/summary
export const getPawnOverdueSummary = async (
  req,
  res
) => {
  try {
    validateQuery(req, []);

    const calculationDate = new Date();

    const summary = await withReadSnapshot(
      async (session) => {
        const counts = {
          activeLoans: 0,
          currentLoans: 0,
          dueToday: 0,
          upcomingDue: 0,
          gracePeriod: 0,
          overdueLoans: 0,
          unclassifiedLoans: 0,
          invalidBalanceCount: 0,
        };

        let overduePrincipalCents = 0n;

        const cursor = PawnLoan.find({
          status: "active",
        })
          .select(LOAN_FIELDS)
          .session(session)
          .lean()
          .cursor({ batchSize: 200 });

        try {
          for await (const loan of cursor) {
            counts.activeLoans += 1;

            const classification = classifyLoan(
              loan,
              calculationDate
            );

            switch (classification.classification) {
              case "current":
                counts.currentLoans += 1;
                break;

              case "due_today":
                counts.dueToday += 1;
                break;

              case "upcoming_due":
                counts.upcomingDue += 1;
                break;

              case "grace_period":
                counts.gracePeriod += 1;
                break;

              case "unclassified":
                counts.unclassifiedLoans += 1;
                break;

              case "overdue": {
                counts.overdueLoans += 1;

                const record = await buildLoanRecord({
                  loan,
                  classification,
                  session,
                });

                if (!record.balance) {
                  counts.invalidBalanceCount += 1;
                  break;
                }

                overduePrincipalCents += toCents(
                  record.balance.outstandingPrincipal
                );

                break;
              }

              default:
                throw new Error(
                  "Unexpected loan classification"
                );
            }
          }
        } finally {
          await cursor.close();
        }

        const totalComplete =
          counts.invalidBalanceCount === 0 &&
          counts.unclassifiedLoans === 0;

        return {
          ...counts,

          totalOverdueOutstandingPrincipal:
            totalComplete
              ? formatMoney(overduePrincipalCents)
              : null,

          knownOverdueOutstandingPrincipal:
            formatMoney(overduePrincipalCents),

          isPrincipalTotalComplete:
            totalComplete,
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      calculationDate,
      currency: "LKR",
      upcomingDays: UPCOMING_DAYS,

      summary,

      includesInterest: false,
      includesPenalties: false,
      penaltyPostingEnabled: false,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load overdue summary"
    );
  }
};

// GET /api/pawn-overdue/:id
export const getPawnOverdueDetails = async (
  req,
  res
) => {
  try {
    validateQuery(req, []);

    const loanId = req.params?.id;

    if (
      typeof loanId !== "string" ||
      !mongoose.isObjectIdOrHexString(loanId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pawn loan ID",
      });
    }

    const calculationDate = new Date();

    const record = await withReadSnapshot(
      async (session) => {
        const loan = await PawnLoan.findOne({
          _id: loanId,
          status: "active",
        })
          .select(LOAN_FIELDS + " goldItems")
          .populate(
            "customer",
            "customerCode fullName nic"
          )
          .populate(
            "goldItems",
            "goldItemCode itemType karat " +
              "grossWeight deductionWeight " +
              "netWeight status"
          )
          .session(session)
          .lean();

        if (!loan) return null;

        const classification = classifyLoan(
          loan,
          calculationDate
        );

        const details = await buildLoanRecord({
          loan,
          classification,
          session,
        });

        return {
          ...details,
          goldItems: loan.goldItems ?? [],
        };
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Active pawn loan not found",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      calculationDate,
      upcomingDays: UPCOMING_DAYS,

      pawnLoan: record,

      isFinalSettlementAmount: false,
      penaltyPostingEnabled: false,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to load overdue loan details"
    );
  }
};