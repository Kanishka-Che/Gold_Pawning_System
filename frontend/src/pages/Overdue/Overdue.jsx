import {
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Clock,
  Wallet,
  CheckCircle,
  RefreshCw,
  Search,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatClassification,
  formatDays,
} from "./overdueFormatters.js";

import OverdueDetails from "./OverdueDetails.jsx";

import "./Overdue.scss";

const PAGE_LIMIT = 20;

const FILTER_OPTIONS = [
  { value: "all", label: "All Active Loans" },
  { value: "current", label: "Current Loans" },
  { value: "due_today", label: "Due Today" },
  { value: "upcoming_due", label: "Upcoming Due" },
  { value: "grace_period", label: "Grace Period" },
  { value: "overdue", label: "Overdue Loans" },
  { value: "unclassified", label: "Unclassified Loans" },
];

function SummaryCard({
  icon: Icon,
  label,
  value,
  variant = "",
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`od-summary-card ${variant}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="od-summary-top">
        <span>{label}</span>
        <Icon size={23} />
      </div>

      <strong>{value ?? "-"}</strong>

      {description && (
        <small>{description}</small>
      )}
    </button>
  );
}

export default function Overdue() {
  const [classification, setClassification] =
    useState("all");

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [reloadKey, setReloadKey] = useState(0);

  const [records, setRecords] = useState(null);

  const [summaryData, setSummaryData] =
    useState(null);

  const [loading, setLoading] = useState(true);

  const [summaryLoading, setSummaryLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [summaryError, setSummaryError] =
    useState("");

  const [selectedLoanId, setSelectedLoanId] =
    useState(null);

  // Load summary independently from filters
  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError("");
      setSummaryData(null);

      try {
        const response = await apiFetch(
          "/api/pawn-overdue/summary",
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.summary
        ) {
          throw new Error(
            data.message ||
              "Failed to load overdue summary"
          );
        }

        if (!controller.signal.aborted) {
          setSummaryData(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setSummaryError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSummaryLoading(false);
        }
      }
    }

    loadSummary();

    return () => controller.abort();
  }, [reloadKey]);

  // Load filtered loan records
  useEffect(() => {
    const controller = new AbortController();

    async function loadRecords() {
      setLoading(true);
      setError("");
      setRecords(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_LIMIT),
          classification,
        });

        if (search) {
          params.set("search", search);
        }

        const response = await apiFetch(
          `/api/pawn-overdue?${params.toString()}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.pawnLoans)
        ) {
          throw new Error(
            data.message ||
              "Failed to load loan records"
          );
        }

        if (!controller.signal.aborted) {
          setRecords(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => controller.abort();
  }, [
    page,
    classification,
    search,
    reloadKey,
  ]);

  const summary = summaryData?.summary;

  const loans = records?.pawnLoans ?? [];

  const accessiblePages = Math.min(
    records?.totalPages ?? 0,
    Math.floor(10000 / PAGE_LIMIT)
  );

  const upcomingDays =
    summaryData?.upcomingDays ??
    records?.upcomingDays ??
    7;

  const changeClassification = (value) => {
    setClassification(value);
    setPage(1);
  };

  const handleSearch = (event) => {
    event.preventDefault();

    setSearch(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setClassification("all");
    setPage(1);
  };

  const refresh = () => {
    setReloadKey((previous) => previous + 1);
  };

  return (
    <div className="overdue-page">
      <header className="od-page-header">
        <div className="od-heading">
          <CalendarClock size={34} />

          <div>
            <h1>Overdue Management</h1>

            <p>
              Monitor loan maturity, grace periods
              and overdue pawn loans.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="od-refresh"
          disabled={loading || summaryLoading}
          onClick={refresh}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      <div className="od-notice">
        <ShieldCheck size={23} />

        <div>
          <strong>Read-only Monitoring</strong>

          <p>
            Loan classifications are calculated
            using Sri Lanka calendar dates.
            Penalty collection, automatic loan
            closure and gold auctions are disabled.
          </p>
        </div>
      </div>

      {summaryError && (
        <div className="od-error" role="alert">
          {summaryError}
        </div>
      )}

      <section className="od-summary-grid">
        <SummaryCard
          icon={Wallet}
          label="Active Loans"
          value={summary?.activeLoans}
          onClick={() =>
            changeClassification("all")
          }
        />

        <SummaryCard
          icon={CheckCircle}
          label="Current Loans"
          value={summary?.currentLoans}
          variant="od-green"
          onClick={() =>
            changeClassification("current")
          }
        />

        <SummaryCard
          icon={CalendarClock}
          label="Due Today"
          value={summary?.dueToday}
          variant="od-gold"
          onClick={() =>
            changeClassification("due_today")
          }
        />

        <SummaryCard
          icon={CalendarDays}
          label="Upcoming Due"
          value={summary?.upcomingDue}
          description={`Next ${upcomingDays} days`}
          variant="od-gold"
          onClick={() =>
            changeClassification("upcoming_due")
          }
        />

        <SummaryCard
          icon={Clock}
          label="Grace Period"
          value={summary?.gracePeriod}
          variant="od-orange"
          onClick={() =>
            changeClassification("grace_period")
          }
        />

        <SummaryCard
          icon={AlertTriangle}
          label="Overdue Loans"
          value={summary?.overdueLoans}
          variant="od-red"
          onClick={() =>
            changeClassification("overdue")
          }
        />

        <SummaryCard
          icon={CircleHelp}
          label="Unclassified Loans"
          value={summary?.unclassifiedLoans}
          onClick={() =>
            changeClassification("unclassified")
          }
        />

        <SummaryCard
          icon={Wallet}
          label="Overdue Principal"
          value={
            summary?.isPrincipalTotalComplete === false
              ? "Incomplete"
              : formatAmount(
                  summary?.totalOverdueOutstandingPrincipal
                )
          }
          description="Excludes interest and penalties"
          variant="od-red"
        />
      </section>

      {summary?.isPrincipalTotalComplete === false && (
        <div className="od-error" role="alert">
          The overdue principal total is incomplete.

          <p>
            Known overdue principal:{" "}
            {formatAmount(
              summary.knownOverdueOutstandingPrincipal
            )}
          </p>

          <p>
            Unclassified loans:{" "}
            {summary.unclassifiedLoans}.
            Invalid overdue balances:{" "}
            {summary.invalidBalanceCount}.
          </p>
        </div>
      )}

      <section className="od-card">
        <div className="od-section-header">
          <div>
            <h2>Loan Monitoring Records</h2>

            <p>
              Search and monitor active pawn loans.
            </p>
          </div>

          <span className="od-record-count">
            {records?.total ?? "-"} Records
          </span>
        </div>

        <form
          className="od-filters"
          onSubmit={handleSearch}
        >
          <div className="od-field">
            <label htmlFor="od-search">
              Search Loans
            </label>

            <div className="od-search-input">
              <Search size={18} />

              <input
                id="od-search"
                type="search"
                maxLength={100}
                placeholder="Loan no, customer, NIC..."
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />
            </div>
          </div>

          <div className="od-field">
            <label htmlFor="od-classification">
              Classification
            </label>

            <select
              id="od-classification"
              value={classification}
              onChange={(event) =>
                changeClassification(
                  event.target.value
                )
              }
            >
              {FILTER_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="od-primary"
          >
            <Search size={16} />
            Search
          </button>

          <button
            type="button"
            className="od-secondary"
            onClick={resetFilters}
          >
            Reset
          </button>
        </form>

        {records?.calculationDate && (
          <p className="od-calculation-date">
            Calculated at:{" "}
            {formatDateTime(
              records.calculationDate
            )}
          </p>
        )}

        {loading && (
          <div className="od-empty" role="status">
            Loading loan records...
          </div>
        )}

        {error && (
          <div className="od-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="od-secondary"
              onClick={refresh}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="od-table-wrapper">
              <table className="od-table">
                <thead>
                  <tr>
                    <th>Loan Number</th>
                    <th>Customer</th>
                    <th>Issue Date</th>
                    <th>Maturity Date</th>
                    <th>Original Principal</th>
                    <th>Outstanding Principal</th>
                    <th>Days Until Due</th>
                    <th>Days Overdue</th>
                    <th>Classification</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan._id}>
                      <td>
                        <strong>
                          {loan.loanNumber}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {loan.customer?.fullName ??
                            "Unavailable"}
                        </strong>

                        <small>
                          {loan.customer?.customerCode ??
                            "-"}
                        </small>
                      </td>

                      <td>
                        {formatDate(loan.issueDate)}
                      </td>

                      <td>
                        {formatDate(loan.maturityDate)}
                      </td>

                      <td>
                        {formatAmount(
                          loan.principalAmount
                        )}
                      </td>

                      <td>
                        {loan.balanceError ? (
                          <span className="od-invalid">
                            Invalid balance
                          </span>
                        ) : (
                          formatAmount(
                            loan.balance
                              ?.outstandingPrincipal
                          )
                        )}
                      </td>

                      <td>
                        {formatDays(
                          loan.daysUntilMaturity
                        )}
                      </td>

                      <td>
                        {formatDays(loan.daysOverdue)}
                      </td>

                      <td>
                        <span
                          className={`od-status ${loan.classification}`}
                        >
                          {formatClassification(
                            loan.classification
                          )}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="od-view-btn"
                          onClick={() =>
                            setSelectedLoanId(
                              loan._id
                            )
                          }
                        >
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}

                  {loans.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="od-empty">
                          <Search size={30} />

                          <strong>
                            No matching loans found
                          </strong>

                          <p>
                            Try changing the search
                            or classification filter.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="od-pagination">
              <span>
                Page {page} of{" "}
                {Math.max(1, accessiblePages)}
              </span>

              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((value) => value - 1)
                  }
                >
                  <ChevronLeft size={17} />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={
                    page >= accessiblePages
                  }
                  onClick={() =>
                    setPage((value) => value + 1)
                  }
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            {records?.totalPages > accessiblePages && (
              <p className="od-calculation-date">
                Refine the filters to access
                additional records.
              </p>
            )}
          </>
        )}
      </section>

      {selectedLoanId && (
        <OverdueDetails
          key={selectedLoanId}
          loanId={selectedLoanId}
          onClose={() =>
            setSelectedLoanId(null)
          }
        />
      )}
    </div>
  );
}