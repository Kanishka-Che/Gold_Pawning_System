const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

export const toCents = (value) => {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new Error("Invalid monetary amount");
  }

  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(
      "Amount must have at most two decimal places"
    );
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > MAX_CENTS) {
    throw new Error("Amount exceeds supported range");
  }

  return cents;
};

export const formatMoney = (cents) => {
  if (
    typeof cents !== "bigint" ||
    cents < 0n ||
    cents > MAX_CENTS
  ) {
    throw new Error("Invalid monetary total");
  }

  return (
    (cents / 100n).toString() +
    "." +
    (cents % 100n).toString().padStart(2, "0")
  );
};

export const getSriLankaDateParts = (
  value = new Date()
) => {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
  };
};

export const getDashboardPeriods = (
  calculationDate = new Date()
) => {
  const { year, month, day } =
    getSriLankaDateParts(calculationDate);

  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");

  const todayStart = new Date(
    `${year}-${monthText}-${dayText}T00:00:00+05:30`
  );

  const tomorrowStart = new Date(
    todayStart.getTime() + 86400000
  );

  const monthStart = new Date(
    `${year}-${monthText}-01T00:00:00+05:30`
  );

  const yearStart = new Date(
    `${year}-01-01T00:00:00+05:30`
  );

  return {
    year,
    month,
    day,
    todayStart,
    tomorrowStart,
    monthStart,
    yearStart,
    calculationDate,
  };
};

export const createFinancialTotals = () => ({
  principalReceived: 0n,
  interestReceived: 0n,
  renewalFees: 0n,
  penaltiesReceived: 0n,
  totalCollections: 0n,
  transactionCount: 0,
});

export const normalizeTransaction = (
  record,
  type
) => {
  let principal = 0n;
  let interest = 0n;
  let fee = 0n;
  let penalty = 0n;
  let date;

  switch (type) {
    case "payment":
      principal = toCents(record.principalPaid);
      interest = toCents(record.interestPaid);
      date = record.paidAt;

      if (
        principal + interest !==
          toCents(record.amount) ||
        principal + interest <= 0n
      ) {
        throw new Error("Invalid payment total");
      }

      break;

    case "renewal":
      interest = toCents(record.interestSettled);
      fee = toCents(record.renewalFeePaid);
      date = record.renewedAt;
      break;

    case "redemption":
      principal = toCents(record.principalSettled);
      interest = toCents(record.interestSettled);
      penalty = toCents(record.penaltySettled);
      date = record.redeemedAt;

      if (
        principal + interest + penalty !==
        toCents(record.totalSettled)
      ) {
        throw new Error("Invalid redemption total");
      }

      break;

    default:
      throw new Error("Unsupported transaction type");
  }

  if (
    !date ||
    !Number.isFinite(new Date(date).getTime())
  ) {
    throw new Error("Invalid transaction date");
  }

  const total = principal + interest + fee + penalty;

  if (total > MAX_CENTS) {
    throw new Error("Transaction exceeds safe range");
  }

  return {
    id: record._id,
    type,
    pawnLoan: record.pawnLoan,
    transactionDate: new Date(date),
    principal,
    interest,
    fee,
    penalty,
    total,
  };
};

export const addTransaction = (totals, transaction) => {
  totals.principalReceived += transaction.principal;
  totals.interestReceived += transaction.interest;
  totals.renewalFees += transaction.fee;
  totals.penaltiesReceived += transaction.penalty;
  totals.totalCollections += transaction.total;
  totals.transactionCount += 1;
};

export const serializeFinancialTotals = (totals) => ({
  principalReceived: formatMoney(
    totals.principalReceived
  ),

  interestReceived: formatMoney(
    totals.interestReceived
  ),

  renewalFees: formatMoney(totals.renewalFees),

  penaltiesReceived: formatMoney(
    totals.penaltiesReceived
  ),

  totalCollections: formatMoney(
    totals.totalCollections
  ),

  transactionCount: totals.transactionCount,
});