export const formatAmount = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "-";
  }

  return new Date(value).toLocaleDateString(
    "en-LK",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
};

export const formatDateTime = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "-";
  }

  return new Date(value).toLocaleString(
    "en-LK",
    {
      timeZone: "Asia/Colombo",
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
};

export const formatClassification = (value) => {
  const labels = {
    current: "Current",
    due_today: "Due Today",
    upcoming_due: "Upcoming Due",
    grace_period: "Grace Period",
    overdue: "Overdue",
    unclassified: "Unclassified",
    not_applicable: "Not Applicable",
  };

  return labels[value] ?? "Unknown";
};

export const formatDays = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    return "-";
  }

  return `${value} ${value === 1 ? "day" : "days"}`;
};

export const formatBoolean = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return "Not configured";
};