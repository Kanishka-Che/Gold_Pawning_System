import {
  getSriLankaDateParts,
} from "./dashboardCalculator.js";

export const reportValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const validateReportQuery = (
  req,
  allowedKeys
) => {
  const params = new URLSearchParams(
    req.originalUrl.split("?")[1] || ""
  );

  for (const key of params.keys()) {
    if (
      !allowedKeys.includes(key) ||
      params.getAll(key).length !== 1
    ) {
      throw reportValidationError(
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
      throw reportValidationError(
        "Invalid query parameters"
      );
    }
  }
};

export const getSriLankaDateKey = (
  value = new Date()
) => {
  const { year, month, day } =
    getSriLankaDateParts(value);

  return (
    `${year}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}`
  );
};

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

export const buildReportDateRange = ({
  fromDate,
  toDate,
  calculationDate = new Date(),
}) => {
  const today =
    getSriLankaDateKey(calculationDate);

  if (
    fromDate === undefined &&
    toDate === undefined
  ) {
    fromDate = today;
    toDate = today;
  }

  if (
    !isValidDate(fromDate) ||
    !isValidDate(toDate) ||
    fromDate < "2000-01-01" ||
    fromDate > toDate ||
    toDate > today
  ) {
    throw reportValidationError(
      "Invalid report date range"
    );
  }

  const startDate = new Date(
    `${fromDate}T00:00:00.000+05:30`
  );

  const endExclusive = new Date(
    new Date(
      `${toDate}T00:00:00.000+05:30`
    ).getTime() + 86400000
  );

  const dayCount =
    (endExclusive.getTime() -
      startDate.getTime()) / 86400000;

  if (dayCount > 366) {
    throw reportValidationError(
      "Report date range cannot exceed 366 days"
    );
  }

  const endDate = new Date(
    Math.min(
      calculationDate.getTime(),
      endExclusive.getTime() - 1
    )
  );

  return {
    fromDate,
    toDate,
    startDate,
    endDate,
    dayCount,
  };
};

export const buildReportYearRange = ({
  year,
  calculationDate = new Date(),
}) => {
  const currentYear =
    getSriLankaDateParts(calculationDate).year;

  const yearText = year ?? String(currentYear);

  if (!/^\d{4}$/.test(yearText)) {
    throw reportValidationError("Invalid year");
  }

  const selectedYear = Number(yearText);

  if (
    selectedYear < 2000 ||
    selectedYear > currentYear
  ) {
    throw reportValidationError("Invalid year");
  }

  const startDate = new Date(
    `${selectedYear}-01-01T00:00:00+05:30`
  );

  const nextYearStart = new Date(
    `${selectedYear + 1}-01-01T00:00:00+05:30`
  );

  const endDate = new Date(
    Math.min(
      calculationDate.getTime(),
      nextYearStart.getTime() - 1
    )
  );

  return {
    year: selectedYear,
    startDate,
    endDate,
  };
};