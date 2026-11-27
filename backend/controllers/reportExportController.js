import {
  getDailyCollectionReport,
  getMonthlyCollectionReport,
  getPawnLoanIssueReport,
  getOutstandingPrincipalReport,
  getOverdueLoansReport,
  getRenewalReport,
  getRedemptionReport,
  getGoldInventoryReport,
  getCustomerReport,
  getFinancialSummaryReport,
} from "./reportsController.js";

const reportHandlers = new Map([
  ["daily-collections", getDailyCollectionReport],
  ["monthly-collections", getMonthlyCollectionReport],
  ["loan-issues", getPawnLoanIssueReport],
  ["outstanding-principal", getOutstandingPrincipalReport],
  ["overdue-loans", getOverdueLoansReport],
  ["renewals", getRenewalReport],
  ["redemptions", getRedemptionReport],
  ["gold-inventory", getGoldInventoryReport],
  ["customers", getCustomerReport],
  ["financial-summary", getFinancialSummaryReport],
]);

export const exportReport = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const handler = reportHandlers.get(
    req.params.reportId
  );

  if (!handler) {
    return res.status(404).json({
      success: false,
      message: "Unsupported report type",
    });
  }

  if (
    req.query.page !== undefined ||
    req.query.limit !== undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Pagination is not supported for exports",
    });
  }

  res.locals.reportExport = true;

  return handler(req, res);
};