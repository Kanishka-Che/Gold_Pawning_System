import {
  useEffect,
  useState,
} from "react";

import {
  FileText,
  RefreshCw,
  AlertCircle,
  Clock,
  LoaderCircle,
} from "lucide-react";

import { apiFetch } from "../../../utils/api";

import ReportFilters from "./ReportFilters";
import ReportSummary from "./ReportSummary";
import ReportTable from "./ReportTable";

import {
  REPORTS,
  createDefaultFilters,
  buildReportQuery,
} from "./reportConfiguration";

import {
  formatDate,
} from "./reportFormatters";

import ReportExportActions from "./ReportExportActions";

import {
  loadReportExportData,
  loadReportShopSettings,
} from "./reportExportData";

import {
  exportReportToExcel,
} from "./reportExcelExporter";

import "./Reports.scss";

export default function Reports() {
  const [reportId, setReportId] = useState(
    REPORTS[0].id
  );

  const report = REPORTS.find(
    (item) => item.id === reportId
  );

  const [filters, setFilters] = useState(() =>
    createDefaultFilters(REPORTS[0])
  );

  const [request, setRequest] = useState(() => ({
    reportId: REPORTS[0].id,
    filters: createDefaultFilters(REPORTS[0]),
    page: 1,
  }));

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [filterError, setFilterError] = useState("");

  const [exporting, setExporting] =
  useState(false);

const [exportError, setExportError] =
  useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadReport = async () => {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const selectedReport = REPORTS.find(
          (item) => item.id === request.reportId
        );

        const query = buildReportQuery(
          selectedReport,
          request.filters,
          request.page
        );

        const response = await apiFetch(
          `/api/reports/${selectedReport.id}${
            query ? `?${query}` : ""
          }`,
          {
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || result.success !== true) {
          throw new Error(
            result.message || "Unable to generate report."
          );
        }

        if (
          !Array.isArray(result.records) ||
          (
  selectedReport.id !== "gold-inventory" &&
  result.currency !== "LKR"
) ||
          result.timeZone !== "Asia/Colombo"
        ) {
          throw new Error("Invalid report response.");
        }

        if (
          !result.summary &&
          !result.periodSummary
        ) {
          throw new Error("Report summary is missing.");
        }

        if (
          selectedReport.paginated &&
          (
            !result.pagination ||
            result.pagination.page !== request.page
          )
        ) {
          throw new Error("Invalid report pagination.");
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || "Unable to load report."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => controller.abort();
  }, [request]);

  const selectReport = (selectedReport) => {

    if (exporting) return;

setExportError("");

    if (selectedReport.id === reportId) return;

    const defaults = createDefaultFilters(
      selectedReport
    );

    setReportId(selectedReport.id);
    setFilters(defaults);
    setFilterError("");
    setError("");
    setData(null);
    setLoading(true);

    setRequest({
      reportId: selectedReport.id,
      filters: defaults,
      page: 1,
    });
  };

  const generateReport = () => {

    if (exporting) return;

setExportError("");

    try {
      buildReportQuery(report, filters, 1);

      setFilterError("");
      setData(null);
      setLoading(true);

      setRequest({
        reportId,
        filters: { ...filters },
        page: 1,
      });
    } catch (err) {
      setFilterError(err.message);
    }
  };

  const resetFilters = () => {

    if (exporting) return;

setExportError("");

    const defaults = createDefaultFilters(report);

    setFilters(defaults);
    setFilterError("");
    setData(null);
    setLoading(true);

    setRequest({
      reportId,
      filters: defaults,
      page: 1,
    });
  };

  const refreshReport = () => {

    if (exporting) return;

setExportError("");

    setData(null);
    setLoading(true);

    setRequest((previous) => ({
      ...previous,
    }));
  };

  const changePage = (page) => {

    if (exporting) return;

setExportError("");

    if (!Number.isInteger(page) || page < 1) {
      return;
    }

    setData(null);
    setLoading(true);

    setRequest((previous) => ({
      ...previous,
      page,
    }));
  };

  const hasUnappliedFilters =
    JSON.stringify(filters) !==
    JSON.stringify(request.filters);

    const handleExcelExport = async () => {
  if (
    exporting ||
    loading ||
    !data ||
    hasUnappliedFilters
  ) {
    return;
  }

  setExporting(true);
  setExportError("");

  const selectedReport = report;

  const appliedFilters = {
    ...request.filters,
  };

  try {
    const [exportData, settings] =
      await Promise.all([
        loadReportExportData({
          report: selectedReport,
          filters: appliedFilters,
        }),

        loadReportShopSettings(),
      ]);

    await exportReportToExcel({
      report: selectedReport,
      filters: appliedFilters,
      data: exportData,
      settings,
    });
  } catch (err) {
    setExportError(
      err.message || "Excel export failed."
    );
  } finally {
    setExporting(false);
  }
};

  return (
    <div className="reports-page">
      <header className="reports-heading">
        <div>
          <h1>
            <FileText size={25} />
            Reports Management
          </h1>

          <p>
            Zriolab Gold Pawning System
          </p>
        </div>

        <button
          type="button"
          className="report-button gold"
          disabled={loading || exporting}
          onClick={refreshReport}
        >
          <RefreshCw
            size={16}
            className={loading ? "report-spin" : ""}
          />

          Refresh
        </button>
      </header>

      <div className="report-notice">
        <AlertCircle size={19} />

        <div>
          <strong>Read-only Reports</strong>

          <p>
            Collections represent recorded transactions.
            Principal received is not profit.
            Outstanding principal excludes accrued interest
            and penalties.
          </p>
        </div>
      </div>

      <section className="report-selection-grid">
        {REPORTS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={reportId === item.id}
              className={`report-selection-card ${
                reportId === item.id ? "selected" : ""
              }`}
              disabled={exporting}
              onClick={() => selectReport(item)}
            >
              <span className="report-selection-icon">
                <Icon size={21} />
              </span>

              <span>
                <strong>{item.title}</strong>
              </span>
            </button>
          );
        })}
      </section>

      <section className="report-active-heading">
        <h2>{report.title}</h2>

        <p>{report.description}</p>
      </section>

      <ReportFilters
        report={report}
        filters={filters}
        setFilters={setFilters}
        onGenerate={generateReport}
        onReset={resetFilters}
        loading={loading}
      />

      {hasUnappliedFilters && (
        <div className="report-notice">
          Filters have changed. Click Generate Report
          to apply them. Existing results use the
          previously applied filters.
        </div>
      )}

      {filterError && (
        <div className="report-error" role="alert">
          <AlertCircle size={18} />
          {filterError}
        </div>
      )}

      {loading ? (
        <section
          className="report-panel report-loading"
          role="status"
        >
          <LoaderCircle
            size={30}
            className="report-spin"
          />

          <p>Generating {report.title} Report...</p>
        </section>
      ) : error ? (
        <div className="report-error" role="alert">
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="report-button secondary"
            loading={loading || exporting}
            onClick={refreshReport}
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          <div className="report-applied-filters">
            <strong>Applied Filters:</strong>

            {report.filters.includes("year") && (
              <span>Year: {request.filters.year}</span>
            )}

            {(
              report.filters.includes("dateRange") ||
              report.filters.includes("optionalDateRange")
            ) && (
              <span>
                {request.filters.fromDate
                  ? `${request.filters.fromDate} to ${request.filters.toDate}`
                  : "All registration dates"}
              </span>
            )}

            {(
              report.filters.includes("customerStatus") ||
              report.filters.includes("inventoryStatus")
            ) && (
              <span>Status: {request.filters.status}</span>
            )}

            {report.filters.includes("karat") && (
              <span>Karat: {request.filters.karat}</span>
            )}

            {report.filters.includes("search") && (
              <span>
                Search: {request.filters.search || "All"}
              </span>
            )}
          </div>

          <ReportExportActions
  disabled={
    loading ||
    !data ||
    hasUnappliedFilters
  }
  exporting={exporting}
  onExcelExport={handleExcelExport}
  report={report}
filters={request.filters}
/>

{exportError && (
  <div className="report-error" role="alert">
    <AlertCircle size={18} />
    {exportError}
  </div>
)}


          <ReportSummary
            report={report}
            data={data}
          />

          <ReportTable
            report={report}
            data={data}
            loading={loading || exporting}
            onPageChange={changePage}
          />

          <footer className="report-footer">
            <Clock size={15} />

            Calculated at:{" "}
            {formatDate(data.calculationDate, true)}
            {" · Sri Lanka Time"}
          </footer>
        </>
      ) : null}
    </div>
  );
}