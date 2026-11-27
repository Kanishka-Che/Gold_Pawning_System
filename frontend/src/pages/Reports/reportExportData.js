import { apiFetch } from "../../../utils/api";

import {
  buildReportQuery,
} from "./reportConfiguration";

export async function loadReportExportData({
  report,
  filters,
  signal,
}) {
  const params = new URLSearchParams(
    buildReportQuery(report, filters, 1)
  );

  params.delete("page");
  params.delete("limit");

  const query = params.toString();

  const response = await apiFetch(
    `/api/reports/${report.id}/export${
      query ? `?${query}` : ""
    }`,
    { signal }
  );

  const result = await response.json();

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || "Unable to export report."
    );
  }

  if (
    !Array.isArray(result.records) ||
    !result.summary ||
    result.timeZone !== "Asia/Colombo" ||
    result.isReadOnly !== true ||
    (
      report.id !== "gold-inventory" &&
      result.currency !== "LKR"
    )
  ) {
    throw new Error("Invalid export response.");
  }

  if (
    report.paginated &&
    (
      !result.pagination ||
      result.pagination.total !==
        result.records.length
    )
  ) {
    throw new Error(
      "Export dataset is incomplete."
    );
  }

  if (result.records.length > 10000) {
    throw new Error("Export record limit exceeded.");
  }

  return result;
}

export async function loadReportShopSettings(signal) {
  const response = await apiFetch(
    "/api/system-settings/printing",
    { signal }
  );

  const result = await response.json();

  if (
    !response.ok ||
    result.success !== true ||
    !result.settings?.shop
  ) {
    throw new Error(
      result.message || "Unable to load shop settings."
    );
  }

  return result.settings;
}

export function getExportFilterRows(report, filters) {
  const rows = [];

  const has = (name) =>
    report.filters.includes(name);

  if (has("year")) {
    rows.push(["Year", filters.year]);
  }

  if (
    has("dateRange") ||
    has("optionalDateRange")
  ) {
    rows.push([
      "From Date",
      filters.fromDate || "All dates",
    ]);

    rows.push([
      "To Date",
      filters.toDate || "All dates",
    ]);
  }

  if (
    has("inventoryStatus") ||
    has("customerStatus")
  ) {
    rows.push(["Status", filters.status]);
  }

  if (has("karat")) {
    rows.push(["Karat", filters.karat]);
  }

  if (has("search")) {
    rows.push([
      "Search Filter",
      filters.search.trim()
        ? "Applied"
        : "None",
    ]);
  }

  return rows;
}

export function getExportWarnings(data) {
  const summary = data.summary ?? {};

  const sources = [
    summary,
    data.currentPosition,
  ].filter(Boolean);

  const warnings = [];

  if (
    sources.some(
      (item) =>
        item.isPrincipalTotalComplete === false
    )
  ) {
    warnings.push(
      "Some principal balances could not be verified."
    );
  }

  if (
    sources.some(
      (item) =>
        item.isClassificationComplete === false
    )
  ) {
    warnings.push(
      "Some active loans could not be classified."
    );
  }

  if (summary.isWeightTotalComplete === false) {
    warnings.push(
      "Some gold item weights are invalid."
    );
  }

  if (summary.missingItemCodeCount > 0) {
    warnings.push(
      `${summary.missingItemCodeCount} gold items have missing item codes.`
    );
  }

  if (summary.reservationWarningCount > 0) {
    warnings.push(
      `${summary.reservationWarningCount} gold items have reservation warnings.`
    );
  }

  return warnings;
}


export async function loadReportLogo(settings, signal) {
  const logoUrl = settings?.shop?.logoUrl;

  if (!logoUrl) return null;

  // Validate the exact backend-generated logo path
  const validLogoPath =
    /^\/api\/system-settings\/logos\/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

  if (
    typeof logoUrl !== "string" ||
    !validLogoPath.test(logoUrl)
  ) {
    throw new Error("Invalid shop logo path.");
  }

  const response = await apiFetch(logoUrl, {
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load shop logo.");
  }

  const blob = await response.blob();

  if (blob.type !== "image/png") {
    throw new Error("Invalid shop logo format.");
  }

  if (blob.size === 0) {
    throw new Error("Shop logo image is empty.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () =>
      reject(new Error("Unable to read shop logo."));

    reader.readAsDataURL(blob);
  });
}
