import {
  AlertTriangle,
  BarChart3,
} from "lucide-react";

import {
  getFieldValue,
  formatReportValue,
} from "./reportFormatters";

function SummaryCards({ fields, values }) {
  return (
    <div className="report-summary-grid">
      {fields.map((field) => {
        const value = getFieldValue(
          values,
          field.key
        );

        return (
          <div
            className="report-summary-card"
            key={field.key}
          >
            <div className="report-summary-top">
              <span>{field.label}</span>

              <BarChart3 size={18} />
            </div>

            <strong
              className={
                field.type === "money" &&
                Number(value) < 0
                  ? "negative-value"
                  : ""
              }
            >
              {formatReportValue(value, field.type)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportSummary({
  report,
  data,
}) {
  const summary =
    data.periodSummary ?? data.summary ?? {};

  const position = data.currentPosition;

  const sources = [summary, position].filter(Boolean);

  const warnings = [];

  if (
    sources.some(
      (item) => item.isPrincipalTotalComplete === false
    )
  ) {
    warnings.push(
      "Some principal balances could not be verified. Incomplete totals are not displayed."
    );
  }

  if (
    sources.some(
      (item) => item.isClassificationComplete === false
    )
  ) {
    warnings.push(
      "Some active loans could not be classified."
    );
  }

  if (summary.isWeightTotalComplete === false) {
    warnings.push(
      "Some gold item weights are invalid. Incomplete weight totals are not displayed."
    );
  }

  if (summary.reservationWarningCount > 0) {
    warnings.push(
      `${summary.reservationWarningCount} gold items have reservation warnings.`
    );
  }

  if (summary.missingItemCodeCount > 0) {
    warnings.push(
      `${summary.missingItemCodeCount} gold items have missing item codes.`
    );
  }

  return (
    <>
      {warnings.length > 0 && (
        <div className="report-warning" role="alert">
          <AlertTriangle size={20} />

          <div>
            <strong>Data Quality Warnings</strong>

            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      )}

      <section className="report-panel">
        <h3>
          {report.id === "financial-summary"
            ? "Selected Period Summary"
            : "Report Summary"}
        </h3>

        <SummaryCards
          fields={report.summary}
          values={summary}
        />
      </section>

      {report.currentPosition && position && (
        <section className="report-panel">
          <h3>Current Financial Position</h3>

          <p className="report-muted">
            Current balances are independent of the
            selected transaction date range.
          </p>

          <SummaryCards
            fields={report.currentPosition}
            values={position}
          />
        </section>
      )}
    </>
  );
}