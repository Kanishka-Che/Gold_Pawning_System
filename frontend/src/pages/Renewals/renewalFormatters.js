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
  if (value === null || value === undefined) {
    return "-";
  }

  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return "-";
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    return "-";
  }

  const formattedWhole = new Intl.NumberFormat(
    "en-LK"
  ).format(cents / 100n);

  const formattedFraction = (cents % 100n)
    .toString()
    .padStart(2, "0");

  return `LKR ${formattedWhole}.${formattedFraction}`;
};

export const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
};

export const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(date);
};