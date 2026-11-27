import {
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";

import {
  getFieldValue,
  formatReportValue,
} from "./reportFormatters";

export function DataTable({
  columns,
  records,
}) {
  return (
    <div className="report-table-wrapper">
      <table className="report-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {records.map((record, index) => (
            <tr
              key={
                record.id ??
                record.key ??
                record.date ??
                record.month ??
                record.karat ??
                index
              }
            >
              {columns.map((column) => {
                const value = getFieldValue(
                  record,
                  column.key
                );

                const formatted = formatReportValue(
                  value,
                  column.type
                );

                return (
                  <td
                    key={column.key}
                    className={
                      column.type === "money" ||
                      column.type === "weight" ||
                      column.type === "number"
                        ? "numeric-cell"
                        : ""
                    }
                  >
                    {column.type === "status" ? (
                      <span
                        className={`report-status ${
                          String(value ?? "unknown")
                            .replace(/[^a-zA-Z0-9_-]/g, "")
                        }`}
                      >
                        {formatted}
                      </span>
                    ) : (
                      formatted
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          {records.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="report-empty"
              >
                <FileText size={28} />

                <p>No records found for the selected filters.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportTable({
  report,
  data,
  onPageChange,
  loading,
}) {
  const records = data.records ?? [];

  const pagination = data.pagination;

  const karatBreakdown =
    data.summary?.karatBreakdown;

  const canGoNext =
    pagination &&
    pagination.page < pagination.totalPages &&
    (pagination.page + 1) * pagination.limit <= 10000;

  return (
    <>
      {report.id === "gold-inventory" &&
        Array.isArray(karatBreakdown) && (
          <section className="report-panel">
            <h3>Gold Weight by Karat</h3>

            <DataTable
              records={karatBreakdown}
              columns={[
                { key: "karat", label: "Karat" },
                {
                  key: "itemCount",
                  label: "Items",
                  type: "number",
                },
                {
                  key: "totalGrossWeight",
                  label: "Gross Weight",
                  type: "weight",
                },
                {
                  key: "totalDeductionWeight",
                  label: "Deduction",
                  type: "weight",
                },
                {
                  key: "totalNetWeight",
                  label: "Net Weight",
                  type: "weight",
                },
                {
                  key: "invalidWeightCount",
                  label: "Invalid Weights",
                  type: "number",
                },
              ]}
            />
          </section>
        )}

      <section className="report-panel">
        <div className="report-panel-heading">
          <h3>Report Details</h3>

          <span className="report-muted">
            {pagination?.total ?? records.length} records
          </span>
        </div>

        <DataTable
          columns={report.columns}
          records={records}
        />

        {pagination && (
          <div className="report-pagination">
            <span>
              Page{" "}
              {pagination.totalPages === 0
                ? 0
                : pagination.page}
              {" "}of {pagination.totalPages}
            </span>

            <div className="report-pagination-actions">
              <button
                type="button"
                className="report-button secondary"
                disabled={loading || pagination.page <= 1}
                onClick={() =>
                  onPageChange(pagination.page - 1)
                }
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <button
                type="button"
                className="report-button secondary"
                disabled={loading || !canGoNext}
                onClick={() =>
                  onPageChange(pagination.page + 1)
                }
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>

            {pagination.total > 10000 && (
              <small>
                Narrow the filters to access additional records.
              </small>
            )}
          </div>
        )}
      </section>
    </>
  );
}