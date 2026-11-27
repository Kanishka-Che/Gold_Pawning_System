import { useEffect, useState } from "react";

import {
  CalendarDays,
  Calendar,
  ClipboardList,
  Wallet,
  Coins,
  ReceiptText,
  Banknote,
  RefreshCw,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import RedemptionDetails from "./RedemptionDetails.jsx";

import {
  getSriLankaToday,
  formatAmount,
  formatDateTime,
} from "./redemptionFormatters.js";

const PAGE_SIZE = 20;
const MAX_PAGINATION_WINDOW = 10000;

export default function RedemptionRecords() {
  const [today] = useState(getSriLankaToday);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
  });

  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const [
    selectedRedemptionId,
    setSelectedRedemptionId,
  ] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadRecords = async () => {
      setLoading(true);
      setError("");
      setRecords([]);
      setSummary(null);
      setTotal(0);
      setTotalPages(0);

      try {
        const listParams = new URLSearchParams({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        const summaryParams = new URLSearchParams({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        });

        const [listResponse, summaryResponse] =
          await Promise.all([
            apiFetch(
              `/api/pawn-redemptions?${listParams}`,
              { signal: controller.signal }
            ),

            apiFetch(
              `/api/pawn-redemptions/summary?${summaryParams}`,
              { signal: controller.signal }
            ),
          ]);

        const [listData, summaryData] =
          await Promise.all([
            listResponse.json(),
            summaryResponse.json(),
          ]);

        if (
          !listResponse.ok ||
          !listData.success ||
          !Array.isArray(listData.redemptions)
        ) {
          throw new Error(
            listData.message ||
              "Failed to load redemption records"
          );
        }

        if (
          !summaryResponse.ok ||
          !summaryData.success ||
          !summaryData.summary
        ) {
          throw new Error(
            summaryData.message ||
              "Failed to load redemption summary"
          );
        }

        if (!controller.signal.aborted) {
          setRecords(listData.redemptions);
          setTotal(listData.total);
          setTotalPages(listData.totalPages);
          setSummary(summaryData.summary);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load redemption records"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadRecords();

    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const handleApplyFilters = (event) => {
    event.preventDefault();

    setFilterError("");

    if (!fromDate || !toDate) {
      setFilterError(
        "Please select both dates."
      );
      return;
    }

    if (fromDate > toDate) {
      setFilterError(
        "From Date cannot be after To Date."
      );
      return;
    }

    setLoading(true);
    setPage(1);

    setFilters({
      fromDate,
      toDate,
    });
  };

  const handleResetFilters = () => {
    const currentDate = getSriLankaToday();

    setFromDate(currentDate);
    setToDate(currentDate);
    setFilterError("");
    setLoading(true);
    setPage(1);

    setFilters({
      fromDate: currentDate,
      toDate: currentDate,
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    setReloadKey((previous) => previous + 1);
  };

  const accessiblePages = Math.min(
    totalPages,
    Math.floor(
      MAX_PAGINATION_WINDOW / PAGE_SIZE
    )
  );

  const summaryCards = [
    {
      label: "Today's Redemptions",
      value: summary?.todayRedemptionCount ?? "-",
      icon: CalendarDays,
    },
    {
      label: "Monthly Redemptions",
      value: summary?.monthlyRedemptionCount ?? "-",
      icon: Calendar,
    },
    {
      label: "Filtered Redemptions",
      value: summary?.redemptionCount ?? "-",
      icon: ClipboardList,
    },
    {
      label: "Principal Settled",
      value: formatAmount(
        summary?.totalPrincipalSettled
      ),
      icon: Wallet,
    },
    {
      label: "Interest Settled",
      value: formatAmount(
        summary?.totalInterestSettled
      ),
      icon: Coins,
    },
    {
      label: "Penalties Settled",
      value: formatAmount(
        summary?.totalPenaltySettled
      ),
      icon: ReceiptText,
    },
    {
      label: "Total Redemption Collections",
      value: formatAmount(
        summary?.totalCollected
      ),
      icon: Banknote,
      highlight: true,
    },
  ];

  return (
    <>
      <div className="rd-card">
        <div className="rd-section-header">
          <div className="rd-heading">
            <ClipboardList size={24} />

            <div>
              <h2>Redemption Overview</h2>

              <p>
                Recorded redemption transactions
                and settlement totals.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="rd-secondary-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh Records
          </button>
        </div>

        <div className="rd-summary-grid">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className={`rd-summary-card ${
                  card.highlight
                    ? "rd-summary-highlight"
                    : ""
                }`}
              >
                <div className="rd-summary-icon">
                  <Icon size={23} />
                </div>

                <span>{card.label}</span>

                <strong>
                  {loading || error
                    ? "-"
                    : card.value}
                </strong>
              </div>
            );
          })}
        </div>

        <p className="rd-record-caption">
          Today's and monthly counts are based
          on Sri Lanka calendar dates.
          Financial totals follow the applied
          date range.
        </p>
      </div>

      <div className="rd-card">
        <div className="rd-section-header">
          <div className="rd-heading">
            <ReceiptText size={24} />

            <div>
              <h2>Redemption Records</h2>

              <p>
                View previously recorded
                redemption transactions.
              </p>
            </div>
          </div>
        </div>

        <form
          className="rd-filter-form"
          onSubmit={handleApplyFilters}
        >
          <label className="rd-filter-field">
            <span>From Date</span>

            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(event.target.value)
              }
              required
            />
          </label>

          <label className="rd-filter-field">
            <span>To Date</span>

            <input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(event.target.value)
              }
              required
            />
          </label>

          <div className="rd-filter-actions">
            <button
              type="submit"
              className="rd-primary-btn"
              disabled={loading}
            >
              <Search size={16} />
              Apply Filters
            </button>

            <button
              type="button"
              className="rd-secondary-btn"
              onClick={handleResetFilters}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </form>

        {filterError && (
          <div className="rd-error" role="alert">
            <AlertCircle size={18} />
            <span>{filterError}</span>
          </div>
        )}

        <p className="rd-record-caption">
          Applied range: {filters.fromDate}
          {" to "}
          {filters.toDate}
        </p>

        {loading && (
          <div className="rd-message" role="status">
            Loading redemption records...
          </div>
        )}

        {error && (
          <div className="rd-error" role="alert">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="rd-table-wrapper">
              <table className="rd-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Loan Number</th>
                    <th>Customer</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Penalty</th>
                    <th>Total Settled</th>
                    <th>Gold Items</th>
                    <th>Recorded By</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => (
                    <tr key={record._id}>
                      <td>
                        {formatDateTime(
                          record.redeemedAt
                        )}
                      </td>

                      <td>
                        {record.pawnLoan
                          ?.loanNumber ?? "-"}
                      </td>

                      <td>
                        <strong>
                          {record.pawnLoan
                            ?.customer
                            ?.fullName ?? "-"}
                        </strong>

                        <small className="rd-customer-code">
                          {record.pawnLoan
                            ?.customer
                            ?.customerCode ?? "-"}
                        </small>
                      </td>

                      <td>
                        {formatAmount(
                          record.principalSettled
                        )}
                      </td>

                      <td>
                        {formatAmount(
                          record.interestSettled
                        )}
                      </td>

                      <td>
                        {formatAmount(
                          record.penaltySettled
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatAmount(
                            record.totalSettled
                          )}
                        </strong>
                      </td>

                      <td>
                        {Array.isArray(
                          record.releasedGoldItems
                        )
                          ? record.releasedGoldItems.length
                          : "-"}
                      </td>

                      <td>
                        {record.redeemedBy
                          ?.username ?? "-"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="rd-secondary-btn"
                          onClick={() =>
                            setSelectedRedemptionId(
                              record._id
                            )
                          }
                        >
                          <Eye size={15} />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}

                  {records.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="rd-empty">
                          <ClipboardList size={38} />

                          <h3>
                            No redemption records found
                          </h3>

                          <p>
                            No recorded redemptions
                            exist in the selected
                            date range.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rd-pagination">
              <span>
                Total Records: {total}
              </span>

              <div className="rd-pagination-buttons">
                <button
                  type="button"
                  className="rd-secondary-btn"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setLoading(true);
                    setPage((previous) =>
                      Math.max(1, previous - 1)
                    );
                  }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span>
                  Page {totalPages === 0 ? 0 : page}
                  {" of "}
                  {accessiblePages}
                </span>

                <button
                  type="button"
                  className="rd-secondary-btn"
                  disabled={
                    loading ||
                    page >= accessiblePages
                  }
                  onClick={() => {
                    setLoading(true);
                    setPage((previous) =>
                      previous + 1
                    );
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {totalPages > accessiblePages && (
              <p className="rd-record-caption">
                Narrow the date range to access
                additional records.
              </p>
            )}
          </>
        )}
      </div>

      {selectedRedemptionId && (
        <RedemptionDetails
          key={selectedRedemptionId}
          redemptionId={selectedRedemptionId}
          onClose={() =>
            setSelectedRedemptionId(null)
          }
        />
      )}
    </>
  );
}