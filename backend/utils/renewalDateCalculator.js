const SRI_LANKA_OFFSET = 330 * 60 * 1000;

export const addRenewalMonths = ({
  baseDate,
  durationMonths,
}) => {
  if (
    !baseDate ||
    !Number.isSafeInteger(durationMonths) ||
    durationMonths < 1 ||
    durationMonths > 120
  ) {
    throw new Error("Invalid renewal date parameters");
  }

  const date = new Date(baseDate);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid renewal base date");
  }

  // Convert to Sri Lanka local calendar time
  const localDate = new Date(
    date.getTime() + SRI_LANKA_OFFSET
  );

  const originalDay = localDate.getUTCDate();

  // Prevent month-end overflow
  localDate.setUTCDate(1);

  localDate.setUTCMonth(
    localDate.getUTCMonth() + durationMonths
  );

  const lastDay = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  localDate.setUTCDate(
    Math.min(originalDay, lastDay)
  );

  const result = new Date(
    localDate.getTime() - SRI_LANKA_OFFSET
  );

  if (
    !Number.isFinite(result.getTime()) ||
    result <= date
  ) {
    throw new Error("Invalid calculated renewal date");
  }

  return result;
};

export const toSriLankaCalendarDay = (value) => {
  if (value == null || value === "") {
    throw new Error("Date is required");
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid calendar date");
  }

  return Math.floor(
    (date.getTime() + SRI_LANKA_OFFSET) /
      86400000
  );
};

export const isValidRenewalExtension = ({
  proposedDate,
  currentMaturityDate,
  calculationDate,
}) => {
  const proposedDay =
    toSriLankaCalendarDay(proposedDate);

  const maturityDay =
    toSriLankaCalendarDay(currentMaturityDate);

  const currentDay =
    toSriLankaCalendarDay(calculationDate);

  return (
    proposedDay > maturityDay &&
    proposedDay > currentDay
  );
};