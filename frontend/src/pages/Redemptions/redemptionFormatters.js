export const getSriLankaToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

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

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Colombo",
  });
};

export const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
  });
};

export const formatStatus = (value) => {
  if (typeof value !== "string" || !value) {
    return "-";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};