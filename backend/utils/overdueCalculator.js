
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toCalendarDay = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  // Sri Lanka calendar date (UTC +05:30)
  const sriLankaTime = new Date(
    date.getTime() + 330 * 60 * 1000
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
}) => {
  if (!loan || typeof loan !== "object") {
    throw new Error("Invalid pawn loan");
  }

  if (!loan.maturityDate) {
    throw new Error("Maturity date is required");
  }

  const maturityDay = toCalendarDay(loan.maturityDate);
  const currentDay = toCalendarDay(calculationDate);

  const daysOverdue = Math.max(
    0,
    Math.round(
      (currentDay - maturityDay) / MS_PER_DAY
    )
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

  // Only active loans can be classified as overdue.
  if (loan.status !== "active") {
    return {
      loanStatus: loan.status,
      overdueStatus: "not_applicable",
      daysOverdue: 0,
      gracePeriodDays,
      daysAfterGrace: 0,
    };
  }

  let overdueStatus = "current";

  if (daysOverdue > gracePeriodDays) {
    overdueStatus = "overdue";
  } else if (daysOverdue > 0) {
    overdueStatus = "grace_period";
  }

  return {
    loanStatus: loan.status,
    overdueStatus,
    daysOverdue,
    gracePeriodDays,
    daysAfterGrace: Math.max(
      0,
      daysOverdue - gracePeriodDays
    ),
  };
};
