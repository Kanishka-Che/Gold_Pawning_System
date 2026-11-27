import {
  Search,
  RotateCcw,
  FileText,
} from "lucide-react";

import {
  getSriLankaToday,
  getSriLankaYear,
} from "./reportFormatters";

export default function ReportFilters({
  report,
  filters,
  setFilters,
  onGenerate,
  onReset,
  loading,
}) {
  const has = (name) =>
    report.filters.includes(name);

  const update = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const currentYear = getSriLankaYear();

  const years = Array.from(
    { length: currentYear - 1999 },
    (_, index) => currentYear - index
  );

  return (
    <section className="report-panel">
      <h3>Report Filters</h3>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <div className="report-filter-grid">
          {(has("dateRange") ||
            has("optionalDateRange")) && (
            <>
              <label>
                {has("optionalDateRange")
                  ? "Registered From (Optional)"
                  : "From Date"}

                <input
                  type="date"
                  min="2000-01-01"
                  max={getSriLankaToday()}
                  value={filters.fromDate}
                  required={has("dateRange")}
                  onChange={(event) =>
                    update("fromDate", event.target.value)
                  }
                />
              </label>

              <label>
                {has("optionalDateRange")
                  ? "Registered To (Optional)"
                  : "To Date"}

                <input
                  type="date"
                  min={filters.fromDate || "2000-01-01"}
                  max={getSriLankaToday()}
                  value={filters.toDate}
                  required={has("dateRange")}
                  onChange={(event) =>
                    update("toDate", event.target.value)
                  }
                />
              </label>
            </>
          )}

          {has("year") && (
            <label>
              Year

              <select
                value={filters.year}
                onChange={(event) =>
                  update("year", event.target.value)
                }
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(has("customerStatus") ||
            has("inventoryStatus")) && (
            <label>
              Status

              <select
                value={filters.status}
                onChange={(event) =>
                  update("status", event.target.value)
                }
              >
                <option value="all">All Statuses</option>

                {has("customerStatus") ? (
                  <>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </>
                ) : (
                  <>
                    <option value="draft">Draft</option>
                    <option value="pledged">Pledged</option>
                    <option value="released">Released</option>
                  </>
                )}
              </select>
            </label>
          )}

          {has("karat") && (
            <label>
              Karat

              <select
                value={filters.karat}
                onChange={(event) =>
                  update("karat", event.target.value)
                }
              >
                <option value="all">All Karats</option>

                {["18K", "21K", "22K", "24K", "OTHER"].map(
                  (karat) => (
                    <option key={karat} value={karat}>
                      {karat}
                    </option>
                  )
                )}
              </select>
            </label>
          )}

          {has("search") && (
            <label>
              Search

              <div className="report-search">
                <Search size={16} />

                <input
                  type="search"
                  maxLength={100}
                  placeholder="Search records..."
                  value={filters.search}
                  onChange={(event) =>
                    update("search", event.target.value)
                  }
                />
              </div>
            </label>
          )}
        </div>

        <div className="report-filter-actions">
          <button
            type="submit"
            className="report-button primary"
            disabled={loading}
          >
            <FileText size={16} />

            {loading ? "Generating..." : "Generate Report"}
          </button>

          <button
            type="button"
            className="report-button secondary"
            onClick={onReset}
            disabled={loading}
          >
            <RotateCcw size={16} />
            Reset Filters
          </button>
        </div>
      </form>
    </section>
  );
}