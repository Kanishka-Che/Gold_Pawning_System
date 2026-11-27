import {
  CalendarDays,
  ChartColumn,
  Wallet,
  Banknote,
  CalendarClock,
  RefreshCw,
  HandCoins,
  Gem,
  Users,
  FileText,
} from "lucide-react";

import {
  getSriLankaToday,
  getSriLankaMonthStart,
  getSriLankaYear,
} from "./reportFormatters";

const field = (key, label, type = "text") => ({
  key,
  label,
  type,
});

const collectionFields = [
  field("principalReceived", "Principal Received", "money"),
  field("interestReceived", "Interest Received", "money"),
  field("renewalFees", "Renewal Fees", "money"),
  field("penaltiesReceived", "Penalties Received", "money"),
  field("totalCollections", "Total Collections", "money"),
  field("transactionCount", "Transactions", "number"),
];

const customerFields = [
  field("customer.customerCode", "Customer Code"),
  field("customer.fullName", "Customer Name"),
];

const loanBalanceFields = [
  field("loanNumber", "Loan Number"),
  ...customerFields,
  field("issueDate", "Issue Date", "date"),
  field("maturityDate", "Maturity Date", "date"),
  field("originalPrincipal", "Original Principal", "money"),
  field("totalPrincipalPaid", "Principal Paid", "money"),
  field("outstandingPrincipal", "Outstanding Principal", "money"),
  field("classification", "Classification", "status"),
  field("balanceError", "Balance Warning"),
  field("classificationError", "Classification Warning"),
];

export const REPORTS = [
  {
    id: "daily-collections",
    title: "Daily Collections",
    icon: CalendarDays,
    description: "Recorded collections by calendar date.",
    filters: ["dateRange"],
    paginated: false,

    summary: collectionFields,

    columns: [
      field("date", "Date", "date"),
      ...collectionFields,
      field("paymentCount", "Payments", "number"),
      field("renewalCount", "Renewals", "number"),
      field("redemptionCount", "Redemptions", "number"),
    ],
  },

  {
    id: "monthly-collections",
    title: "Monthly Collections",
    icon: ChartColumn,
    description: "Monthly recorded collections for a selected year.",
    filters: ["year"],
    paginated: false,

    summary: collectionFields,

    columns: [
      field("month", "Month", "month"),
      ...collectionFields,
      field("isFutureMonth", "Future Month", "boolean"),
    ],
  },

  {
    id: "loan-issues",
    title: "Pawn Loan Issues",
    icon: Wallet,
    description: "Pawn loans activated within the selected period.",
    filters: ["dateRange"],
    paginated: true,

    summary: [
      field("totalIssuedLoans", "Issued Loans", "number"),
      field("totalIssuedPrincipal", "Issued Principal", "money"),
      field("statusCounts.active", "Currently Active", "number"),
      field("statusCounts.redeemed", "Currently Redeemed", "number"),
      field("statusCounts.closed", "Currently Closed", "number"),
    ],

    columns: [
      field("loanNumber", "Loan Number"),
      ...customerFields,
      field("principalAmount", "Principal", "money"),
      field("issueDate", "Issue Date", "date"),
      field("maturityDate", "Maturity Date", "date"),
      field("activatedAt", "Activated At", "datetime"),
      field("goldItemCount", "Gold Items", "number"),
      field("status", "Current Status", "status"),
      field("settingsVersion", "Settings Version", "number"),
      field("createdBy", "Created By"),
    ],
  },

  {
    id: "outstanding-principal",
    title: "Outstanding Principal",
    icon: Banknote,
    description: "Current outstanding principal excluding interest and penalties.",
    filters: ["search"],
    paginated: true,

    summary: [
      field("activeLoans", "Active Loans", "number"),
      field("totalOriginalPrincipal", "Original Principal", "money"),
      field("totalPrincipalPaid", "Principal Paid", "money"),
      field("totalOutstandingPrincipal", "Outstanding Principal", "money"),
      field("invalidBalanceCount", "Invalid Balances", "number"),
    ],

    columns: loanBalanceFields,
  },

  {
    id: "overdue-loans",
    title: "Overdue Loans",
    icon: CalendarClock,
    description: "Active loans beyond their configured grace period.",
    filters: ["search"],
    paginated: true,

    summary: [
      field("activeLoans", "Active Loans", "number"),
      field("overdueLoans", "Overdue Loans", "number"),
      field("gracePeriod", "In Grace Period", "number"),
      field("totalOutstandingPrincipal", "Overdue Principal", "money"),
      field("unclassifiedLoans", "Unclassified Loans", "number"),
      field("invalidBalanceCount", "Invalid Balances", "number"),
    ],

    columns: [
      ...loanBalanceFields,
      field("daysOverdue", "Days Overdue", "number"),
      field("gracePeriodDays", "Grace Days", "number"),
      field("daysAfterGrace", "Days After Grace", "number"),
    ],
  },

  {
    id: "renewals",
    title: "Renewals",
    icon: RefreshCw,
    description: "Recorded pawn loan renewal transactions.",
    filters: ["dateRange"],
    paginated: true,

    summary: [
      field("renewalCount", "Total Renewals", "number"),
      field("totalInterestSettled", "Interest Settled", "money"),
      field("totalRenewalFees", "Renewal Fees", "money"),
      field("totalCollected", "Total Collected", "money"),
    ],

    columns: [
      field("loanNumber", "Loan Number"),
      ...customerFields,
      field("renewedAt", "Renewed At", "datetime"),
      field("previousMaturityDate", "Previous Maturity", "date"),
      field("newMaturityDate", "New Maturity", "date"),
      field("interestSettled", "Interest Settled", "money"),
      field("renewalFeePaid", "Renewal Fee", "money"),
      field("totalCollected", "Total Collected", "money"),
      field("renewedBy", "Renewed By"),
    ],
  },

  {
    id: "redemptions",
    title: "Redemptions",
    icon: HandCoins,
    description: "Recorded redemption settlements and released gold items.",
    filters: ["dateRange"],
    paginated: true,

    summary: [
      field("redemptionCount", "Total Redemptions", "number"),
      field("totalPrincipalSettled", "Principal Settled", "money"),
      field("totalInterestSettled", "Interest Settled", "money"),
      field("totalPenaltySettled", "Penalties Settled", "money"),
      field("totalCollected", "Total Collected", "money"),
      field("releasedGoldItemCount", "Released Items", "number"),
    ],

    columns: [
      field("loanNumber", "Loan Number"),
      ...customerFields,
      field("redeemedAt", "Redeemed At", "datetime"),
      field("principalSettled", "Principal Settled", "money"),
      field("interestSettled", "Interest Settled", "money"),
      field("penaltySettled", "Penalty Settled", "money"),
      field("totalCollected", "Total Collected", "money"),
      field("releasedGoldItemCount", "Released Items", "number"),
      field("redeemedBy", "Redeemed By"),
    ],
  },

  {
    id: "gold-inventory",
    title: "Gold Inventory",
    icon: Gem,
    description: "Current gold inventory and weight breakdown.",
    filters: ["inventoryStatus", "karat", "search"],
    paginated: true,

    summary: [
      field("totalItems", "Filtered Items", "number"),
      field("statusCounts.pledged", "Pledged Items", "number"),
      field("statusCounts.draft", "Draft Items", "number"),
      field("statusCounts.released", "Released Items", "number"),
      field("totalGrossWeight", "Gross Weight", "weight"),
      field("totalDeductionWeight", "Deduction Weight", "weight"),
      field("totalNetWeight", "Net Weight", "weight"),
      field("missingItemCodeCount", "Missing Item Codes", "number"),
      field("invalidWeightCount", "Invalid Weights", "number"),
      field("reservationWarningCount", "Reservation Warnings", "number"),
    ],

    columns: [
      field("goldItemCode", "Item Code"),
      field("itemType", "Item Type"),
      field("description", "Description"),
      field("karat", "Karat"),
      field("grossWeight", "Gross Weight", "weight"),
      field("deductionWeight", "Deduction", "weight"),
      field("netWeight", "Net Weight", "weight"),
      field("status", "Status", "status"),
      field("loanNumber", "Loan Number"),
      ...customerFields,
      field("weightError", "Weight Warning"),
      field("reservationWarning", "Reservation Warning"),
    ],
  },

  {
    id: "customers",
    title: "Customers",
    icon: Users,
    description: "Customer records, loan counts and current outstanding balances.",
    filters: [
      "customerStatus",
      "search",
      "optionalDateRange",
    ],
    paginated: true,

    summary: [
      field("totalCustomers", "All Registered Customers", "number"),
      field("activeCustomers", "All Active Customers", "number"),
      field("inactiveCustomers", "All Inactive Customers", "number"),
      field("filteredCustomerCount", "Matching Customers", "number"),
      field("newCustomers", "New Customers", "number"),
      field("totalLoans", "Matching Customer Loans", "number"),
      field("activeLoans", "Matching Active Loans", "number"),
      field("totalOutstandingPrincipal", "Matching Outstanding Principal", "money"),
      field("invalidBalanceCount", "Invalid Balances", "number"),
    ],

    columns: [
      field("customerCode", "Customer Code"),
      field("fullName", "Full Name"),
      field("registeredAt", "Registered Date", "date"),
      field("status", "Status", "status"),
      field("totalLoans", "Total Loans", "number"),
      field("activeLoans", "Active Loans", "number"),
      field("redeemedLoans", "Redeemed Loans", "number"),
      field("closedLoans", "Closed Loans", "number"),
      field("cancelledLoans", "Cancelled Loans", "number"),
      field("outstandingPrincipal", "Outstanding Principal", "money"),
      field("invalidBalanceCount", "Invalid Balances", "number"),
    ],
  },

  {
    id: "financial-summary",
    title: "Financial Summary",
    icon: FileText,
    description: "Period cash movement and current financial position.",
    filters: ["dateRange"],
    paginated: false,

    summary: [
      field("totalIssuedLoans", "Issued Loans", "number"),
      field("totalIssuedPrincipal", "Issued Principal", "money"),
      ...collectionFields,
      field("nonPrincipalCollections", "Non-Principal Collections", "money"),
      field("netLoanCashMovement", "Net Loan Cash Movement", "money"),
    ],

    currentPosition: [
      field("activeLoans", "Active Loans", "number"),
      field("currentLoans", "Current Loans", "number"),
      field("dueToday", "Due Today", "number"),
      field("upcomingDue", "Upcoming Due", "number"),
      field("gracePeriod", "Grace Period", "number"),
      field("overdueLoans", "Overdue Loans", "number"),
      field("totalOutstandingPrincipal", "Outstanding Principal", "money"),
      field("invalidBalanceCount", "Invalid Balances", "number"),
    ],

    columns: [
      field("label", "Description"),
      field("category", "Category", "status"),
      field("amount", "Amount", "money"),
    ],
  },
];

export const PAGE_SIZE = 20;

export const createDefaultFilters = (report) => ({
  fromDate: report.filters.includes("optionalDateRange")
    ? ""
    : getSriLankaMonthStart(),

  toDate: report.filters.includes("optionalDateRange")
    ? ""
    : getSriLankaToday(),

  year: String(getSriLankaYear()),

  status: report.id === "gold-inventory"
    ? "pledged"
    : "all",

  karat: "all",
  search: "",
});

export const buildReportQuery = (
  report,
  filters,
  page = 1
) => {
  const params = new URLSearchParams();

  const has = (name) =>
    report.filters.includes(name);

  if (
    has("dateRange") ||
    has("optionalDateRange")
  ) {
    const { fromDate, toDate } = filters;

    const required = has("dateRange");

    if (required || fromDate || toDate) {
      if (!fromDate || !toDate) {
        throw new Error("Select both From Date and To Date.");
      }

      if (
        fromDate < "2000-01-01" ||
        fromDate > toDate ||
        toDate > getSriLankaToday()
      ) {
        throw new Error("Invalid report date range.");
      }

      const days =
        (Date.parse(toDate) - Date.parse(fromDate)) /
          86400000 +
        1;

      if (!Number.isFinite(days) || days > 366) {
        throw new Error("Date range cannot exceed 366 days.");
      }

      params.set("fromDate", fromDate);
      params.set("toDate", toDate);
    }
  }

  if (has("year")) {
    params.set("year", filters.year);
  }

  if (
    has("inventoryStatus") ||
    has("customerStatus")
  ) {
    params.set("status", filters.status);
  }

  if (has("karat")) {
    params.set("karat", filters.karat);
  }

  if (has("search") && filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (report.paginated) {
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
  }

  return params.toString();
};