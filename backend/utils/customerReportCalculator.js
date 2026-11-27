import Customer from "../models/Customer.js";
import PawnLoan from "../models/PawnLoan.js";

import {
  getLoanBalance,
} from "./activeLoanReportCalculator.js";

import {
  toCents,
  formatMoney,
} from "./dashboardCalculator.js";

export const CUSTOMER_REPORT_STATUSES = [
  "all",
  "active",
  "inactive",
];

const createLoanCounts = () => ({
  totalLoans: 0,
  draftLoans: 0,
  activeLoans: 0,
  redeemedLoans: 0,
  closedLoans: 0,
  cancelledLoans: 0,
  unknownLoans: 0,
});

const addLoanCount = (counts, status) => {
  counts.totalLoans += 1;

  switch (status) {
    case "draft":
      counts.draftLoans += 1;
      break;

    case "active":
      counts.activeLoans += 1;
      break;

    case "redeemed":
      counts.redeemedLoans += 1;
      break;

    case "closed":
      counts.closedLoans += 1;
      break;

    case "cancelled":
      counts.cancelledLoans += 1;
      break;

    default:
      counts.unknownLoans += 1;
  }
};

const getCustomerLoanSummary = async ({
  customerId,
  session,
}) => {
  const loanCounts = createLoanCounts();

  let knownOutstandingPrincipal = 0n;
  let invalidBalanceCount = 0;

  const cursor = PawnLoan.find({
    customer: customerId,
  })
    .select("_id status principalAmount")
    .session(session)
    .lean()
    .cursor({ batchSize: 100 });

  try {
    for await (const loan of cursor) {
      addLoanCount(loanCounts, loan.status);

      if (loan.status !== "active") {
        continue;
      }

      const { balance } = await getLoanBalance({
        loan,
        session,
      });

      if (!balance) {
        invalidBalanceCount += 1;
        continue;
      }

      knownOutstandingPrincipal += toCents(
        balance.outstandingPrincipal
      );
    }
  } finally {
    await cursor.close();
  }

  return {
    loanCounts,
    knownOutstandingPrincipal,
    invalidBalanceCount,
  };
};

export const buildCustomerReport = async ({
  session,
  status = "all",
  search = "",
  registrationRange = null,
  page,
  limit,
}) => {
  const records = [];

  const normalizedSearch =
    search.trim().toLowerCase();

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const statusCounts = {
    active: 0,
    inactive: 0,
    unknown: 0,
  };

  const filteredStatusCounts = {
    active: 0,
    inactive: 0,
    unknown: 0,
  };

  const loanCounts = createLoanCounts();

  let totalCustomers = 0;
  let filteredCustomerCount = 0;
  let newCustomers = 0;

  let knownOutstandingPrincipal = 0n;
  let invalidBalanceCount = 0;

  const cursor = Customer.find()
    .select(
      "_id customerCode fullName nic " +
      "status createdAt"
    )
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .session(session)
    .lean()
    .cursor({ batchSize: 100 });

  try {
    for await (const customer of cursor) {
      totalCustomers += 1;

      const customerStatus =
        ["active", "inactive"].includes(
          customer.status
        )
          ? customer.status
          : "unknown";

      statusCounts[customerStatus] += 1;

      const registeredAt = customer.createdAt
        ? new Date(customer.createdAt).getTime()
        : NaN;

      const matchesRegistrationRange =
        !registrationRange ||
        (
          Number.isFinite(registeredAt) &&
          registeredAt >=
            registrationRange.startDate.getTime() &&
          registeredAt <=
            registrationRange.endDate.getTime()
        );

      if (
        registrationRange &&
        matchesRegistrationRange
      ) {
        newCustomers += 1;
      }

      if (
        status !== "all" &&
        customerStatus !== status
      ) {
        continue;
      }

      if (!matchesRegistrationRange) {
        continue;
      }

      if (normalizedSearch) {
        const matchesSearch = [
          customer.customerCode,
          customer.fullName,
          customer.nic,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(normalizedSearch)
        );

        if (!matchesSearch) {
          continue;
        }
      }

      filteredStatusCounts[customerStatus] += 1;

      const customerLoans =
        await getCustomerLoanSummary({
          customerId: customer._id,
          session,
        });

      for (const key of Object.keys(loanCounts)) {
        loanCounts[key] +=
          customerLoans.loanCounts[key];
      }

      knownOutstandingPrincipal +=
        customerLoans.knownOutstandingPrincipal;

      invalidBalanceCount +=
        customerLoans.invalidBalanceCount;

      const isBalanceComplete =
        customerLoans.invalidBalanceCount === 0;

      if (
        filteredCustomerCount >= startIndex &&
        filteredCustomerCount < endIndex
      ) {
        records.push({
          id: customer._id,

          customerCode: customer.customerCode,

          fullName: customer.fullName,

          status: customerStatus,

          registeredAt: customer.createdAt,

          ...customerLoans.loanCounts,

          outstandingPrincipal:
            isBalanceComplete
              ? formatMoney(
                  customerLoans
                    .knownOutstandingPrincipal
                )
              : null,

          knownOutstandingPrincipal:
            formatMoney(
              customerLoans
                .knownOutstandingPrincipal
            ),

          invalidBalanceCount:
            customerLoans.invalidBalanceCount,

          isBalanceComplete,
        });
      }

      filteredCustomerCount += 1;
    }
  } finally {
    await cursor.close();
  }

  const isPrincipalTotalComplete =
    invalidBalanceCount === 0;

  return {
    summary: {
      totalCustomers,

      activeCustomers: statusCounts.active,

      inactiveCustomers: statusCounts.inactive,

      unknownCustomers: statusCounts.unknown,

      newCustomers: registrationRange
        ? newCustomers
        : null,

      filteredCustomerCount,

      filteredStatusCounts,

      ...loanCounts,

      totalOutstandingPrincipal:
        isPrincipalTotalComplete
          ? formatMoney(
              knownOutstandingPrincipal
            )
          : null,

      knownOutstandingPrincipal:
        formatMoney(
          knownOutstandingPrincipal
        ),

      invalidBalanceCount,

      isPrincipalTotalComplete,
    },

    records,

    pagination: {
      page,
      limit,
      total: filteredCustomerCount,
      totalPages: Math.ceil(
        filteredCustomerCount / limit
      ),
    },
  };
};