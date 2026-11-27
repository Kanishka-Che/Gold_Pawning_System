import { useEffect, useState } from "react";

import {
  CalendarDays,
  CalendarClock,
  Coins,
  Wallet,
  ReceiptText,
  RefreshCw,
  Eye,
  ClipboardList,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import {
  getSriLankaToday,
  formatAmount,
  formatDate,
  formatDateTime,
} from "./renewalFormatters.js";

import RenewalDetails from "./RenewalDetails.jsx";

import "./RenewalRecords.scss";

const PAGE_LIMIT = 20;
const MAX_PAGINATION_WINDOW = 10000;

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rr-summary-card">
      <div className="rr-summary-icon">
        <Icon size={23} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function RenewalRecords() {
  const [initialToday] = useState(getSriLankaToday);

  const [fromDate, setFromDate] =
    useState(initialToday);

  const [toDate, setToDate] =
    useState(initialToday);

  const [filters, setFilters] = useState({
    fromDate: initialToday,
    toDate: initialToday,
  });

  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const [selectedRenewalId, setSelectedRenewalId] =
    useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecords() {
      setLoading(true);
      setError("");
      setData(null);
      setSummary(null);

      try {
        const summaryParams = new URLSearchParams({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        });

        const listParams = new URLSearchParams({
          ...filters,
          page: String(page),
          limit: String(PAGE_LIMIT),
        });

        const [listResponse, summaryResponse] =
          await Promise.all([
            apiFetch(
              `/api/pawn-renewals?${listParams}`,
              { signal: controller.signal }
            ),

            apiFetch(
              `/api/pawn-renewals/summary?${summaryParams}`,
              { signal: controller.signal }
            ),
          ]);

        const [listData, summaryData] =
          await Promise.all([
            listResponse.json().catch(() => null),
            summaryResponse.json().catch(() => null),
          ]);

        if (
          !listResponse.ok ||
          !listData?.success ||
          !Array.isArray(listData.renewals) ||
          !Number.isSafeInteger(listData.total) ||
          listData.total < 0 ||
          !Number.isSafeInteger(listData.totalPages) ||
          listData.totalPages < 0 ||
          listData.page !== page
        ) {
          throw new Error(
            listData?.message ||
              "Failed to load renewal records."
          );
        }

        if (
          !summaryResponse.ok ||
          !summaryData?.success ||
          !summaryData.summary ||
          summaryData.fromDate !== filters.fromDate ||
          summaryData.toDate !== filters.toDate
        ) {
          throw new Error(
            summaryData?.message ||
              "Failed to load renewal summary."
          );
        }

        if (!controller.signal.aborted) {
          setData(listData);
          setSummary(summaryData.summary);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load renewal information."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const applyFilters = (event) => {
    event.preventDefault();

    setFilterError("");

    if (!fromDate || !toDate || fromDate > toDate) {
      setFilterError("Select a valid date range.");
      return;
    }

    setLoading(true);
    setPage(1);

    setFilters({
      fromDate,
      toDate,
    });
  };

  const resetFilters = () => {
    const today = getSriLankaToday();

    setFromDate(today);
    setToDate(today);
    setFilterError("");
    setLoading(true);
    setPage(1);

    setFilters({
      fromDate: today,
      toDate: today,
    });
  };

  const refreshRecords = () => {
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const accessiblePages = Math.max(
    1,
    Math.min(
      data?.totalPages ?? 0,
      Math.floor(
        MAX_PAGINATION_WINDOW / PAGE_LIMIT
      )
    )
  );

  const cards = [
    {
      label: "Today's Renewals",
      value: summary?.todayRenewalCount,
      icon: CalendarDays,
    },
    {
      label: "Month-to-Date Renewals",
      value: summary?.monthlyRenewalCount,
      icon: CalendarClock,
    },
    {
      label: "Filtered Renewals",
      value: summary?.renewalCount,
      icon: ClipboardList,
    },
    {
      label: "Interest Settled",
      value: formatAmount(
        summary?.totalInterestSettled
      ),
      icon: Coins,
    },
    {
      label: "Renewal Fees",
      value: formatAmount(
        summary?.totalRenewalFees
      ),
      icon: ReceiptText,
    },
    {
      label: "Total Collected",
      value: formatAmount(summary?.totalCollected),
      icon: Wallet,
    },
  ];

  return (
    <section className="renewal-records">
      <div className="rr-heading">
        <div>
          <h2>Renewal Overview</h2>

          <p>
            Recorded renewals and collected amounts.
          </p>
        </div>

        <button
          type="button"
          className="rr-secondary"
          disabled={loading}
          onClick={refreshRecords}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="rr-summary-grid">
        {cards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            icon={card.icon}
            value={
              loading
                ? "..."
                : card.value ?? "-"
            }
          />
        ))}
      </div>

      <p className="rr-summary-note">
        Today and month-to-date counts are independent
        of the selected date range. Other totals
        reflect the applied date filters.
      </p>

      <div className="rr-history">
        <div className="rr-heading">
          <div>
            <h2>Renewal Records</h2>

            <p>
              Search recorded renewals by date range.
            </p>
          </div>
        </div>

        <form
          className="rr-filters"
          onSubmit={applyFilters}
        >
          <label>
            <span>From Date</span>

            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              required
              onChange={(event) =>
                setFromDate(event.target.value)
              }
            />
          </label>

          <label>
            <span>To Date</span>

            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              required
              onChange={(event) =>
                setToDate(event.target.value)
              }
            />
          </label>

          <div className="rr-filter-actions">
            <button
              type="submit"
              className="rr-primary"
              disabled={loading}
            >
              Apply Filters
            </button>

            <button
              type="button"
              className="rr-secondary"
              disabled={loading}
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>
        </form>

        {filterError && (
          <div className="rr-error" role="alert">
            {filterError}
          </div>
        )}

        <div className="rr-applied-filter">
          Applied range: {filters.fromDate} to{" "}
          {filters.toDate}
        </div>

        {loading && (
          <div className="rr-message" role="status">
            Loading renewal records...
          </div>
        )}

        {error && (
          <div className="rr-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="rr-secondary"
              onClick={refreshRecords}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="rr-table-caption">
              Total Records: {data.total}
            </div>

            <div className="rr-table-wrapper">
              <table className="rr-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Loan Number</th>
                    <th>Customer</th>
                    <th>Previous Maturity</th>
                    <th>New Maturity</th>
                    <th>Interest Settled</th>
                    <th>Renewal Fee</th>
                    <th>Renewed By</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {data.renewals.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="rr-empty">
                          <ClipboardList size={38} />

                          <strong>
                            No renewal records found.
                          </strong>

                          <span>
                            No recorded renewals exist
                            in the selected date range.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.renewals.map((renewal) => (
                      <tr key={renewal._id}>
                        <td>
                          {formatDateTime(
                            renewal.renewedAt
                          )}
                        </td>

                        <td>
                          <strong>
                            {renewal.pawnLoan
                              ?.loanNumber || "-"}
                          </strong>
                        </td>

                        <td>
                          <strong>
                            {renewal.pawnLoan?.customer
                              ?.fullName || "-"}
                          </strong>

                          <small>
                            {renewal.pawnLoan?.customer
                              ?.customerCode || "-"}
                          </small>
                        </td>

                        <td>
                          {formatDate(
                            renewal.previousMaturityDate
                          )}
                        </td>

                        <td>
                          {formatDate(
                            renewal.newMaturityDate
                          )}
                        </td>

                        <td>
                          {formatAmount(
                            renewal.interestSettled
                          )}
                        </td>

                        <td>
                          {formatAmount(
                            renewal.renewalFeePaid
                          )}
                        </td>

                        <td>
                          {renewal.renewedBy?.username ||
                            "-"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="rr-view-btn"
                            onClick={() =>
                              setSelectedRenewalId(
                                renewal._id
                              )
                            }
                          >
                            <Eye size={15} />
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data.totalPages > accessiblePages && (
              <p className="rr-summary-note">
                Narrow the date range to access records
                beyond the pagination limit.
              </p>
            )}

            {(data.totalPages > 1 || page > 1) && (
              <div className="rr-pagination">
                <button
                  type="button"
                  className="rr-secondary"
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true);
                    setPage((value) => value - 1);
                  }}
                >
                  Previous
                </button>

                <span>
                  Page {page} of {accessiblePages}
                </span>

                <button
                  type="button"
                  className="rr-secondary"
                  disabled={page >= accessiblePages}
                  onClick={() => {
                    setLoading(true);
                    setPage((value) => value + 1);
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRenewalId && (
        <RenewalDetails
          key={selectedRenewalId}
          renewalId={selectedRenewalId}
          onClose={() => setSelectedRenewalId(null)}
        />
      )}
    </section>
  );
}