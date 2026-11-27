const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SRI_LANKA_OFFSET = 330 * 60 * 1000;

const DEFAULT_UPCOMING_DAYS = 7;

const toCalendarDay = (value) => {
  if (
    !(value instanceof Date) &&
    (typeof value !== "string" || !value.trim())
  ) {
    throw new Error("Invalid date");
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date");
  }

  const sriLankaTime = new Date(
    date.getTime() + SRI_LANKA_OFFSET
  );

  return Date.UTC(
    sriLankaTime.getUTCFullYear(),
    sriLankaTime.getUTCMonth(),
    sriLankaTime.getUTCDate()
  );
};

export const calculateOverdueStatus = ({
  loan,
  calculationDate = new Date(),
  upcomingDays = DEFAULT_UPCOMING_DAYS,
}) => {
  if (!loan || typeof loan !== "object") {
    throw new Error("Invalid pawn loan");
  }

  if (
    !Number.isSafeInteger(upcomingDays) ||
    upcomingDays < 1 ||
    upcomingDays > 365
  ) {
    throw new Error("Invalid upcoming due period");
  }

  if (!loan.maturityDate) {
    throw new Error("Maturity date is required");
  }

  const maturityDay = toCalendarDay(
    loan.maturityDate
  );

  const currentDay = toCalendarDay(
    calculationDate
  );

  const dayDifference = Math.round(
    (currentDay - maturityDay) / MS_PER_DAY
  );

  const gracePeriodDays =
    loan.settingsSnapshot?.overdue?.gracePeriodDays;

  if (
    !Number.isSafeInteger(gracePeriodDays) ||
    gracePeriodDays < 0
  ) {
    throw new Error(
      "Valid overdue grace period settings are required"
    );
  }

  // Non-active loans are excluded.
  if (loan.status !== "active") {
    return {
      loanStatus: loan.status,
      overdueStatus: "not_applicable",
      classification: "not_applicable",

      daysOverdue: 0,
      daysUntilMaturity: null,

      gracePeriodDays,
      daysAfterGrace: 0,
      remainingGraceDays: 0,

      isDueToday: false,
      isUpcomingDue: false,
      isOverdue: false,
    };
  }

  const daysOverdue = Math.max(
    0,
    dayDifference
  );

  const daysUntilMaturity = Math.max(
    0,
    -dayDifference
  );

  const daysAfterGrace = Math.max(
    0,
    daysOverdue - gracePeriodDays
  );

  let overdueStatus = "current";

  let classification = "current";

  if (daysOverdue > gracePeriodDays) {
    overdueStatus = "overdue";
    classification = "overdue";
  } else if (daysOverdue > 0) {
    overdueStatus = "grace_period";
    classification = "grace_period";
  } else if (dayDifference === 0) {
    classification = "due_today";
  } else if (
    daysUntilMaturity > 0 &&
    daysUntilMaturity <= upcomingDays
  ) {
    classification = "upcoming_due";
  }

  const remainingGraceDays =
    classification === "grace_period"
      ? Math.max(
          0,
          gracePeriodDays - daysOverdue
        )
      : 0;

  return {
    loanStatus: loan.status,

    // Preserve existing module compatibility.
    overdueStatus,

    // New Overdue Management classification.
    classification,

    daysOverdue,
    daysUntilMaturity,

    gracePeriodDays,
    daysAfterGrace,
    remainingGraceDays,

    isDueToday:
      classification === "due_today",

    isUpcomingDue:
      classification === "upcoming_due",

    isOverdue:
      classification === "overdue",
  };
};