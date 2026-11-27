export const getSriLankaToday = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
};

export const getSriLankaMonthStart = () =>
  `${getSriLankaToday().slice(0, 7)}-01`;

export const getSriLankaYear = () =>
  Number(getSriLankaToday().slice(0, 4));

export const formatMoney = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(String(value))) {
    return "—";
  }

  const [whole, fraction = ""] =
    String(value).replace(/^-/, "").split(".");

  const amount =
    BigInt(whole).toLocaleString("en-US") +
    "." +
    fraction.padEnd(2, "0");

  return `${String(value).startsWith("-") ? "-" : ""}LKR ${amount}`;
};

export const formatWeight = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (!/^\d+(\.\d{1,3})?$/.test(String(value))) {
    return "—";
  }

  const [whole, fraction = ""] =
    String(value).split(".");

  return (
    BigInt(whole).toLocaleString("en-US") +
    "." +
    fraction.padEnd(3, "0") +
    " g"
  );
};

export const formatDate = (
  value,
  includeTime = false
) => {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",

    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      : {}),
  });
};

export const formatStatus = (value) =>
  value == null
    ? "—"
    : String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );

export const formatMonth = (value) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return months[Number(value) - 1] ?? "—";
};

export const getFieldValue = (record, path) =>
  path.split(".").reduce(
    (value, key) => value?.[key],
    record
  );

export const formatReportValue = (
  value,
  type = "text"
) => {
  if (value === null || value === undefined) {
    return "—";
  }

  switch (type) {
    case "money":
      return formatMoney(value);

    case "weight":
      return formatWeight(value);

    case "date":
      return formatDate(value);

    case "datetime":
      return formatDate(value, true);

    case "month":
      return formatMonth(value);

    case "status":
      return formatStatus(value);

    case "number":
      return typeof value === "number" &&
        Number.isFinite(value)
        ? value.toLocaleString("en-US")
        : "—";

    case "boolean":
      return value === true
        ? "Yes"
        : value === false
          ? "No"
          : "—";

    default:
      return value === "" ? "—" : String(value);
  }
};