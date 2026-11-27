import PawnLoan from "../models/PawnLoan.js";

import {
  toCents,
  formatMoney,
  getSriLankaDateParts,
  createFinancialTotals,
  addTransaction,
  serializeFinancialTotals,
} from "../utils/dashboardCalculator.js";

import {
  buildCustomerReport,
  CUSTOMER_REPORT_STATUSES,
} from "../utils/customerReportCalculator.js";

import {
  buildFinancialSummaryReport,
} from "../utils/financialSummaryReportCalculator.js";

import {
  buildActiveLoanReport,
} from "../utils/activeLoanReportCalculator.js";

import {
  buildSettlementReport,
} from "../utils/settlementReportCalculator.js";

import {
  buildGoldInventoryReport,
  INVENTORY_STATUSES,
  INVENTORY_KARATS,
} from "../utils/goldInventoryReportCalculator.js";

import {
  validateReportQuery,
  reportValidationError,
  getSriLankaDateKey,
  buildReportDateRange,
  buildReportYearRange,
} from "../utils/reportDateRange.js";

import {
  withReportSnapshot,
  scanReportTransactions,
  createTransactionCounts,
  addTransactionCount,
} from "../utils/reportCalculator.js";

const MAX_PAGE_SIZE = 100;
const MAX_PAGINATION_WINDOW = 10000;
const MAX_EXPORT_RECORDS = 10000;

const handleReportError = (
  res,
  error,
  message
) => {
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

const parsePositiveInteger = (
  value,
  fallback
) => {
  if (value === undefined) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw reportValidationError(
      "Invalid pagination parameters"
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw reportValidationError(
      "Invalid pagination parameters"
    );
  }

  return parsed;
};

const getReportPagination = (req, res) => {
  if (res.locals.reportExport === true) {
    if (
      req.query.page !== undefined ||
      req.query.limit !== undefined
    ) {
      throw reportValidationError(
        "Pagination is not supported for exports"
      );
    }

    return {
      page: 1,
      limit: MAX_EXPORT_RECORDS,
    };
  }

  const page = parsePositiveInteger(
    req.query.page,
    1
  );

  const limit = parsePositiveInteger(
    req.query.limit,
    20
  );

  if (
    limit > MAX_PAGE_SIZE ||
    !Number.isSafeInteger(page * limit) ||
    page * limit > MAX_PAGINATION_WINDOW
  ) {
    throw reportValidationError(
      "Invalid pagination parameters"
    );
  }

  return { page, limit };
};

const validateExportResult = (res, result) => {
  if (res.locals.reportExport !== true) {
    return;
  }

  const total =
    result.pagination?.total ??
    result.records.length;

  if (total > MAX_EXPORT_RECORDS) {
    throw reportValidationError(
      `Export exceeds ${MAX_EXPORT_RECORDS} records. Narrow the report filters.`
    );
  }

  if (result.records.length !== total) {
    throw new Error(
      "Export dataset is incomplete"
    );
  }
};


const createCollectionBucket = () => ({
  ...createFinancialTotals(),
  ...createTransactionCounts(),
});

const addCollectionTransaction = (
  bucket,
  transaction
) => {
  addTransaction(bucket, transaction);

  addTransactionCount(
    bucket,
    transaction.type
  );
};

const serializeCollectionBucket = (
  bucket
) => ({
  ...serializeFinancialTotals(bucket),

  paymentCount: bucket.paymentCount,
  renewalCount: bucket.renewalCount,
  redemptionCount: bucket.redemptionCount,
});

// =========================================
// DAILY COLLECTION REPORT
// GET /api/reports/daily-collections
// =========================================

export const getDailyCollectionReport = async (
  req,
  res
) => {
  try {
    validateReportQuery(req, [
      "fromDate",
      "toDate",
    ]);

    const calculationDate = new Date();

    const range = buildReportDateRange({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      calculationDate,
    });

    const result = await withReportSnapshot(
      async (session) => {
        const dailyBuckets = new Map();

        const totals =
          createCollectionBucket();

        // Include dates without transactions.
        for (
          let index = 0;
          index < range.dayCount;
          index += 1
        ) {
          const date = new Date(
            range.startDate.getTime() +
              index * 86400000
          );

          dailyBuckets.set(
            getSriLankaDateKey(date),
            createCollectionBucket()
          );
        }

        await scanReportTransactions({
          session,
          startDate: range.startDate,
          endDate: range.endDate,

          onTransaction: (transaction) => {
            const dateKey =
              getSriLankaDateKey(
                transaction.transactionDate
              );

            const bucket =
              dailyBuckets.get(dateKey);

            if (!bucket) {
              throw new Error(
                "Transaction outside report range"
              );
            }

            addCollectionTransaction(
              bucket,
              transaction
            );

            addCollectionTransaction(
              totals,
              transaction
            );
          },
        });

        const records = Array.from(
          dailyBuckets.entries()
        ).map(([date, bucket]) => ({
          date,
          ...serializeCollectionBucket(bucket),
        }));

        return {
          summary:
            serializeCollectionBucket(totals),

          records,
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      reportType: "daily_collections",
      currency: "LKR",
      timeZone: "Asia/Colombo",
      calculationDate,

      fromDate: range.fromDate,
      toDate: range.toDate,
      dayCount: range.dayCount,

      isReadOnly: true,
      isProfitReport: false,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Failed to generate daily collection report"
    );
  }
};

// =========================================
// MONTHLY COLLECTION REPORT
// GET /api/reports/monthly-collections
// =========================================

export const getMonthlyCollectionReport = async (
  req,
  res
) => {
  try {
    validateReportQuery(req, ["year"]);

    const calculationDate = new Date();

    const range = buildReportYearRange({
      year: req.query.year,
      calculationDate,
    });

    const currentParts =
      getSriLankaDateParts(calculationDate);

    const result = await withReportSnapshot(
      async (session) => {
        const months = Array.from(
          { length: 12 },
          () => createCollectionBucket()
        );

        const totals =
          createCollectionBucket();

        await scanReportTransactions({
          session,
          startDate: range.startDate,
          endDate: range.endDate,

          onTransaction: (transaction) => {
            const { month } =
              getSriLankaDateParts(
                transaction.transactionDate
              );

            addCollectionTransaction(
              months[month - 1],
              transaction
            );

            addCollectionTransaction(
              totals,
              transaction
            );
          },
        });

        const records = months.map(
          (bucket, index) => {
            const month = index + 1;

            const isFutureMonth =
              range.year === currentParts.year &&
              month > currentParts.month;

            return {
              month,
              isFutureMonth,
              ...serializeCollectionBucket(bucket),
            };
          }
        );

        return {
          summary:
            serializeCollectionBucket(totals),

          records,
        };
      }
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      reportType: "monthly_collections",
      currency: "LKR",
      timeZone: "Asia/Colombo",
      calculationDate,

      year: range.year,

      isReadOnly: true,
      isProfitReport: false,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Failed to generate monthly collection report"
    );
  }
};

// =========================================
// PAWN LOAN ISSUE REPORT
// GET /api/reports/loan-issues
// =========================================

export const getPawnLoanIssueReport = async (
  req,
  res
) => {
  try {
    validateReportQuery(req, [
      "fromDate",
      "toDate",
      "page",
      "limit",
    ]);

    const calculationDate = new Date();

    const range = buildReportDateRange({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      calculationDate,
    });

    const { page, limit } =
  getReportPagination(req, res);

    const filter = {
      activatedAt: {
        $gte: range.startDate,
        $lte: range.endDate,
      },

      status: {
        $in: [
          "active",
          "redeemed",
          "closed",
        ],
      },
    };

    const result = await withReportSnapshot(
      async (session) => {
        let totalIssuedPrincipal = 0n;
        let totalIssuedLoans = 0;

        const statusCounts = {
          active: 0,
          redeemed: 0,
          closed: 0,
        };

        const cursor = PawnLoan.find(filter)
          .select("principalAmount status")
          .session(session)
          .lean()
          .cursor({ batchSize: 200 });

        try {
          for await (const loan of cursor) {
            const principal = toCents(
              loan.principalAmount
            );

            if (principal <= 0n) {
              throw new Error(
                "Invalid issued principal"
              );
            }

            totalIssuedPrincipal += principal;
            totalIssuedLoans += 1;

            statusCounts[loan.status] += 1;
          }
        } finally {
          await cursor.close();
        }

        const loans = await PawnLoan.find(filter)
          .select(
            "_id loanNumber customer " +
            "principalAmount interestRate " +
            "issueDate maturityDate " +
            "activatedAt status goldItems " +
            "settingsVersion createdBy"
          )
          .populate(
            "customer",
            "customerCode fullName"
          )
          .populate(
            "createdBy",
            "username"
          )
          .sort({
            activatedAt: -1,
            _id: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .session(session)
          .lean();

        const records = loans.map((loan) => ({
          id: loan._id,
          loanNumber: loan.loanNumber,

          customer: loan.customer ?? null,

          principalAmount: formatMoney(
            toCents(loan.principalAmount)
          ),

          interestRate: loan.interestRate,

          issueDate: loan.issueDate,
          maturityDate: loan.maturityDate,
          activatedAt: loan.activatedAt,

          status: loan.status,

          goldItemCount: Array.isArray(
            loan.goldItems
          )
            ? loan.goldItems.length
            : 0,

          settingsVersion: loan.settingsVersion,

          createdBy:
            loan.createdBy?.username ?? null,
        }));

        return {
          summary: {
            totalIssuedLoans,

            totalIssuedPrincipal:
              formatMoney(totalIssuedPrincipal),

            statusCounts,
          },

          records,

          pagination: {
            page,
            limit,
            total: totalIssuedLoans,

            totalPages: Math.ceil(
              totalIssuedLoans / limit
            ),
          },
        };
      }
    );

    validateExportResult(res, result);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      reportType: "loan_issues",
      currency: "LKR",
      timeZone: "Asia/Colombo",
      calculationDate,

      fromDate: range.fromDate,
      toDate: range.toDate,

      dateBasis: "activatedAt",
      isReadOnly: true,
      isProfitReport: false,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Failed to generate pawn loan issue report"
    );
  }
};

// =========================================
// SHARED ACTIVE LOAN REPORT HANDLER
// =========================================

const generateActiveLoanReport = async (
  req,
  res,
  overdueOnly
) => {
  try {
    validateReportQuery(req, [
      "page",
      "limit",
      "search",
    ]);

    const { page, limit } =
  getReportPagination(req, res);

    const search =
      (req.query.search ?? "").trim();

    if (search.length > 100) {
      throw reportValidationError(
        "Search must not exceed 100 characters"
      );
    }

    const calculationDate = new Date();

    const result = await withReportSnapshot(
      async (session) => {
        return buildActiveLoanReport({
          session,
          calculationDate,
          page,
          limit,
          overdueOnly,
          search,
        });
      }
    );

    validateExportResult(res, result);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      reportType: overdueOnly
        ? "overdue_loans"
        : "outstanding_principal",

      currency: "LKR",

      timeZone: "Asia/Colombo",

      calculationDate,

      search,

      dateBasis: "current_snapshot",

      includesInterest: false,
      includesPenalties: false,

      isReadOnly: true,
      isProfitReport: false,
      isFinalSettlementAmount: false,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,

      overdueOnly
        ? "Failed to generate overdue loans report"
        : "Failed to generate outstanding principal report"
    );
  }
};

// =========================================
// OUTSTANDING PRINCIPAL REPORT
// GET /api/reports/outstanding-principal
// =========================================

export const getOutstandingPrincipalReport =
  async (req, res) => {
    return generateActiveLoanReport(
      req,
      res,
      false
    );
  };

// =========================================
// OVERDUE LOANS REPORT
// GET /api/reports/overdue-loans
// =========================================

export const getOverdueLoansReport =
  async (req, res) => {
    return generateActiveLoanReport(
      req,
      res,
      true
    );
  };

  // =========================================
// SHARED SETTLEMENT REPORT HANDLER
// =========================================

const generateSettlementReport = async (
  req,
  res,
  type
) => {
  try {
    validateReportQuery(req, [
      "fromDate",
      "toDate",
      "page",
      "limit",
    ]);

    const calculationDate = new Date();

    const range = buildReportDateRange({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      calculationDate,
    });

    const { page, limit } =
  getReportPagination(req, res);

    const result = await withReportSnapshot(
      async (session) => {
        return buildSettlementReport({
          session,
          type,
          startDate: range.startDate,
          endDate: range.endDate,
          page,
          limit,
        });
      }
    );

    validateExportResult(res, result);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      reportType:
        type === "renewal"
          ? "renewals"
          : "redemptions",

      currency: "LKR",

      timeZone: "Asia/Colombo",

      calculationDate,

      fromDate: range.fromDate,
      toDate: range.toDate,

      dateBasis:
        type === "renewal"
          ? "renewedAt"
          : "redeemedAt",

      isReadOnly: true,
      isProfitReport: false,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      `Failed to generate ${type} report`
    );
  }
};

// =========================================
// RENEWAL REPORT
// GET /api/reports/renewals
// =========================================

export const getRenewalReport = async (
  req,
  res
) => {
  return generateSettlementReport(
    req,
    res,
    "renewal"
  );
};

// =========================================
// REDEMPTION REPORT
// GET /api/reports/redemptions
// =========================================

export const getRedemptionReport = async (
  req,
  res
) => {
  return generateSettlementReport(
    req,
    res,
    "redemption"
  );
};

// =========================================
// GOLD INVENTORY REPORT
// GET /api/reports/gold-inventory
// =========================================

export const getGoldInventoryReport = async (
  req,
  res
) => {
  try {
    validateReportQuery(req, [
      "status",
      "karat",
      "search",
      "page",
      "limit",
    ]);

    const status =
      req.query.status ?? "pledged";

    const karat =
      req.query.karat ?? "all";

    const search =
      (req.query.search ?? "").trim();

    if (!INVENTORY_STATUSES.includes(status)) {
      throw reportValidationError(
        "Invalid gold inventory status"
      );
    }

    if (!INVENTORY_KARATS.includes(karat)) {
      throw reportValidationError(
        "Invalid gold karat"
      );
    }

    if (search.length > 100) {
      throw reportValidationError(
        "Search must not exceed 100 characters"
      );
    }

    const { page, limit } =
  getReportPagination(req, res);

    const calculationDate = new Date();

    const result = await withReportSnapshot(
      async (session) => {
        return buildGoldInventoryReport({
          session,
          status,
          karat,
          search,
          page,
          limit,
        });
      }
    );

    validateExportResult(res, result);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,

      reportType: "gold_inventory",

      timeZone: "Asia/Colombo",

      calculationDate,

      dateBasis: "current_snapshot",

      weightUnit: "g",

      weightDecimalPlaces: 3,

      filters: {
        status,
        karat,
        search,
      },

      isReadOnly: true,

      includesMarketValuation: false,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Failed to generate gold inventory report"
    );
  }
};

// =========================================
// CUSTOMER REPORT
// GET /api/reports/customers
// =========================================

export const getCustomerReport = async (
  req,
  res
) => {
  res.set("Cache-Control", "no-store");

  try {
    validateReportQuery(req, [
      "status",
      "search",
      "fromDate",
      "toDate",
      "page",
      "limit",
    ]);

    const status =
      req.query.status ?? "all";

    const search =
      (req.query.search ?? "").trim();

    if (
      !CUSTOMER_REPORT_STATUSES.includes(status)
    ) {
      throw reportValidationError(
        "Invalid customer status"
      );
    }

    if (search.length > 100) {
      throw reportValidationError(
        "Search must not exceed 100 characters"
      );
    }

    const { page, limit } =
  getReportPagination(req, res);

    const calculationDate = new Date();

    let registrationRange = null;

    if (
      req.query.fromDate !== undefined ||
      req.query.toDate !== undefined
    ) {
      registrationRange =
        buildReportDateRange({
          fromDate: req.query.fromDate,
          toDate: req.query.toDate,
          calculationDate,
        });
    }

    const result = await withReportSnapshot(
      async (session) => {
        return buildCustomerReport({
          session,
          status,
          search,
          registrationRange,
          page,
          limit,
        });
      }
    );

    validateExportResult(res, result);

    return res.status(200).json({
      success: true,

      reportType: "customers",

      currency: "LKR",

      timeZone: "Asia/Colombo",

      calculationDate,

      dateBasis: "customer_createdAt",

      loanBalanceDateBasis:
        "current_snapshot",

      filters: {
        status,
        search,

        fromDate:
          registrationRange?.fromDate ?? null,

        toDate:
          registrationRange?.toDate ?? null,
      },

      includesInterest: false,

      includesPenalties: false,

      isReadOnly: true,

      ...result,
    });
  } catch (error) {
    return handleReportError(
      res,
      error,
      "Failed to generate customer report"
    );
  }
};

// =========================================
// FINANCIAL SUMMARY REPORT
// GET /api/reports/financial-summary
// =========================================

export const getFinancialSummaryReport =
  async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
      validateReportQuery(req, [
        "fromDate",
        "toDate",
      ]);

      const calculationDate = new Date();

      const range = buildReportDateRange({
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        calculationDate,
      });

      const result = await withReportSnapshot(
        async (session) => {
          return buildFinancialSummaryReport({
            session,

            startDate: range.startDate,

            endDate: range.endDate,

            calculationDate,
          });
        }
      );

      return res.status(200).json({
        success: true,

        reportType: "financial_summary",

        currency: "LKR",

        timeZone: "Asia/Colombo",

        calculationDate,

        fromDate: range.fromDate,

        toDate: range.toDate,

        dayCount: range.dayCount,

        issuedPrincipalDateBasis:
          "activatedAt",

        collectionDateBasis:
          "transaction_date",

        outstandingPrincipalDateBasis:
          "current_snapshot",

        isReadOnly: true,

        isProfitReport: false,

        includesBusinessExpenses: false,

        includesAccruedInterest: false,

        includesUncollectedPenalties: false,

        ...result,
      });
    } catch (error) {
      return handleReportError(
        res,
        error,
        "Failed to generate financial summary report"
      );
    }
  };