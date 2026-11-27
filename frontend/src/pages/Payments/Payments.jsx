import { useEffect, useState } from "react";

import {
  Wallet,
  Banknote,
  Coins,
  ReceiptText,
  RefreshCw,
  CalendarDays,
  ShieldCheck,
  Eye,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";
import PaymentLoanSearch from "./PaymentLoanSearch.jsx";
import PaymentPreview from "./PaymentPreview.jsx";
import PaymentDetails from "./PaymentDetails.jsx";

import "./Payments.scss";

const getSriLankaToday = () => {
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

const formatAmount = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "-";
  }

  return new Date(value).toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatMethod = (method) => {
  if (method === "cash") return "Cash";
  if (method === "bank_transfer") {
    return "Bank Transfer";
  }

  return "Unknown";
};

export default function Payments() {
  const [today] = useState(getSriLankaToday);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [paymentMethod, setPaymentMethod] =
    useState("");

  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
    paymentMethod: "",
  });
const [selectedLoan, setSelectedLoan] = useState(null);
const [selectedPaymentId, setSelectedPaymentId] =
  useState(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const limit = 20;

  useEffect(() => {
    const controller = new AbortController();

    const loadPayments = async () => {
      try {
        setLoading(true);
        setError("");
        setData(null);
        setSummary(null);

        const summaryParams = new URLSearchParams({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        });

        if (filters.paymentMethod) {
          summaryParams.set(
            "paymentMethod",
            filters.paymentMethod
          );
        }

        const listParams = new URLSearchParams(
          summaryParams
        );

        listParams.set("page", String(page));
        listParams.set("limit", String(limit));

        const [listResponse, summaryResponse] =
          await Promise.all([
            apiFetch(
              `/api/pawn-payments?${listParams}`,
              { signal: controller.signal }
            ),

            apiFetch(
              `/api/pawn-payments/summary?${summaryParams}`,
              { signal: controller.signal }
            ),
          ]);

        const [listResult, summaryResult] =
          await Promise.all([
            listResponse.json(),
            summaryResponse.json(),
          ]);

        if (
          !listResponse.ok ||
          !listResult.success
        ) {
          throw new Error(
            listResult.message ||
              "Failed to load payments."
          );
        }

        if (
          !summaryResponse.ok ||
          !summaryResult.success
        ) {
          throw new Error(
            summaryResult.message ||
              "Failed to load payment summary."
          );
        }

        if (!controller.signal.aborted) {
          setData(listResult);
          setSummary(summaryResult.summary);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load payment information."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadPayments();

    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const handleApplyFilters = (event) => {
    event.preventDefault();

    setFilterError("");

    if (!fromDate || !toDate) {
      setFilterError("Please select both dates.");
      return;
    }

    if (fromDate > toDate) {
      setFilterError(
        "From date cannot be after to date."
      );
      return;
    }

    setPage(1);

    setFilters({
      fromDate,
      toDate,
      paymentMethod,
    });
  };

  const handleReset = () => {
    const currentDate = getSriLankaToday();

    setFromDate(currentDate);
    setToDate(currentDate);
    setPaymentMethod("");
    setFilterError("");
    setPage(1);

    setFilters({
      fromDate: currentDate,
      toDate: currentDate,
      paymentMethod: "",
    });
  };

  const cards = [
    {
      title: "Total Collections",
      value: formatAmount(summary?.totalAmount),
      icon: Wallet,
    },
    {
      title: "Interest Collected",
      value: formatAmount(
        summary?.totalInterestPaid
      ),
      icon: Coins,
    },
    {
      title: "Principal Collected",
      value: formatAmount(
        summary?.totalPrincipalPaid
      ),
      icon: Banknote,
    },
    {
      title: "Payment Records",
      value: summary?.paymentCount ?? "-",
      icon: ReceiptText,
    },
  ];

  const totalPages = Math.max(
    1,
    Number(data?.totalPages) || 1
  );

  const accessiblePages = Math.min(
    totalPages,
    Math.floor(10000 / limit)
  );

  return (
    <section className="payments-page">
      <div className="payments-header">
        <div>
          <span className="payments-subtitle">
            FINANCIAL MANAGEMENT
          </span>

          <h1>Payment Management</h1>

          <p>
            View pawn loan repayments and collections.
          </p>
        </div>

        <button
          type="button"
          className="payments-secondary-btn"
          disabled={loading}
          onClick={() =>
            setReloadKey((value) => value + 1)
          }
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="payments-security-notice">
        <ShieldCheck size={22} />

        <div>
          <strong>Read-only payment management</strong>

          <p>
            New payment recording is currently disabled.
            Existing payment records can be viewed.
          </p>
        </div>
      </div>

    <PaymentLoanSearch
  onLoanSelected={setSelectedLoan}
/>

{selectedLoan && (
  <PaymentPreview
    key={selectedLoan._id}
    loan={selectedLoan}
  />
)}

      <div className="payments-summary-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              className="payments-summary-card"
              key={card.title}
            >
              <div className="payments-card-icon">
                <Icon size={23} />
              </div>

              <span>{card.title}</span>

              <strong>
                {loading ? "Loading..." : card.value}
              </strong>
            </div>
          );
        })}
      </div>

      <div className="payments-filter-panel">
        <h3>
          <CalendarDays size={20} />
          Payment Filters
        </h3>

        <form onSubmit={handleApplyFilters}>
          <div className="payments-filter-grid">
            <label>
              From Date

              <input
                type="date"
                value={fromDate}
                onChange={(event) =>
                  setFromDate(event.target.value)
                }
                required
              />
            </label>

            <label>
              To Date

              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(event) =>
                  setToDate(event.target.value)
                }
                required
              />
            </label>

            <label>
              Payment Method

              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>

                <option value="bank_transfer">
                  Bank Transfer
                </option>
              </select>
            </label>
          </div>

          {filterError && (
            <p className="payments-error" role="alert">
              {filterError}
            </p>
          )}

          <div className="payments-filter-actions">
            <button
              type="submit"
              className="payments-primary-btn"
              disabled={loading}
            >
              Apply Filters
            </button>

            <button
              type="button"
              className="payments-secondary-btn"
              onClick={handleReset}
              disabled={loading}
            >
              Reset to Today
            </button>
          </div>
        </form>
      </div>

      <div className="payments-table-panel">
        <div className="payments-table-header">
          <div>
            <h3>Payment Records</h3>

            <p>
              {filters.fromDate} to {filters.toDate}
            </p>
          </div>

          <span>
            {data ? `${data.total} records` : "-"}
          </span>
        </div>

        {loading && (
          <div className="payments-empty">
            Loading payment records...
          </div>
        )}

        {error && (
          <p className="payments-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            {data.payments?.length ? (
              <div className="payments-table-wrapper">
                <table className="payments-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Loan Number</th>
                      <th>Customer</th>
                      <th>Total Paid</th>
                      <th>Interest</th>
                      <th>Principal</th>
                      <th>Method</th>
                      <th>Recorded By</th>
                      <th>Reference</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.payments.map((payment) => (
                      <tr key={payment._id}>
                        <td>
                          {formatDate(payment.paidAt)}
                        </td>

                        <td className="payments-loan-number">
                          {payment.pawnLoan?.loanNumber ||
                            "-"}
                        </td>

                        <td>
                          {payment.pawnLoan?.customer
                            ?.fullName || "-"}
                        </td>

                        <td>
                          {formatAmount(payment.amount)}
                        </td>

                        <td>
                          {formatAmount(
                            payment.interestPaid
                          )}
                        </td>

                        <td>
                          {formatAmount(
                            payment.principalPaid
                          )}
                        </td>

                        <td>
                          <span className="payments-method">
                            {formatMethod(
                              payment.paymentMethod
                            )}
                          </span>
                        </td>

                        <td>
                          {payment.recordedBy?.username ||
                            "-"}
                        </td>

                        <td>{payment.reference || "-"}</td>
                        <td>
  <button
    type="button"
    className="payments-view-btn"
    onClick={() =>
      setSelectedPaymentId(payment._id)
    }
  >
    <Eye size={16} />
    View Details
  </button>
</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="payments-empty">
                <ReceiptText size={38} />

                <h4>No payment records found</h4>

                <p>
                  No payments match the selected filters.
                </p>
              </div>
            )}

            {accessiblePages > 1 && (
              <div className="payments-pagination">
                <button
                  type="button"
                  className="payments-secondary-btn"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((value) => value - 1)
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of {accessiblePages}
                </span>

                <button
                  type="button"
                  className="payments-secondary-btn"
                  disabled={page >= accessiblePages}
                  onClick={() =>
                    setPage((value) => value + 1)
                  }
                >
                  Next
                </button>
              </div>
            )}

            {totalPages > accessiblePages && (
              <p className="payments-empty">
                Narrow the date range to view more records.
              </p>
            )}
          </>
        )}
            </div>

      {selectedPaymentId && (
        <PaymentDetails
          key={selectedPaymentId}
          paymentId={selectedPaymentId}
          onClose={() =>
            setSelectedPaymentId(null)
          }
        />
      )}

    </section>
  );
}