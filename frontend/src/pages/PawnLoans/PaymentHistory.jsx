
import { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api";

const formatAmount = (value) => {
  if (value === null || value === undefined) return "—";

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "—";

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) return "—";

  return new Date(value).toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function PaymentHistory({ loanId }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
    setData(null);
    setError("");
  }, [loanId]);

  useEffect(() => {
    if (!loanId) return;

    const controller = new AbortController();

    async function loadPayments() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await apiFetch(
          `/api/pawn-loans/${loanId}/payments?page=${page}&limit=20`,
          { signal: controller.signal }
        );

        
const result = await response.json().catch(() => null);

if (!response.ok || !result?.success) {
  throw new Error(
    result?.message || "Failed to load payment history."
  );
}

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Failed to load payments.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPayments();

    return () => controller.abort();
  }, [loanId, page]);

  const totalPages = Math.max(
    1,
    Number(data?.totalPages) || 1
  );

  return (
    <div className="loan-payment-history">
      <h3>Payment History</h3>
      <p>
        Read-only payment records for this pawn loan.
      </p>

      {loading && <p>Loading payment history...</p>}

      {error && (
        <p className="loan-error-message" role="alert">
          {error}
        </p>
      )}

      {!loading && data && (
        <>
          <div className="loan-details-grid">
            <div className="loan-info-card">
              <span>Total Payments Received</span>
              <strong>
                {formatAmount(data.summary?.totalAmount)}
              </strong>
            </div>

            <div className="loan-info-card">
              <span>Total Interest Paid</span>
              <strong>
                {formatAmount(
                  data.summary?.totalInterestPaid
                )}
              </strong>
            </div>

            <div className="loan-info-card">
              <span>Total Principal Paid</span>
              <strong>
                {formatAmount(
                  data.summary?.totalPrincipalPaid
                )}
              </strong>
            </div>

            <div className="loan-info-card">
              <span>Payment Records</span>
              <strong>{data.total ?? 0}</strong>
            </div>
          </div>

          {data.payments?.length ? (
            <div className="payment-history-table-wrapper">
  <table className="payment-history-table">
                <thead>
                  <tr>
                    <th>Payment Date</th>
                    <th>Total Paid</th>
                    <th>Interest Paid</th>
                    <th>Principal Paid</th>
                    <th>Method</th>
                    <th>Recorded By</th>
                    <th>Reference</th>
                  </tr>
                </thead>

                <tbody>
                  {data.payments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{formatDate(payment.paidAt)}</td>
                      <td>{formatAmount(payment.amount)}</td>
                      <td>
                        {formatAmount(payment.interestPaid)}
                      </td>
                      <td>
                        {formatAmount(payment.principalPaid)}
                      </td>
                      <td>
                        {payment.paymentMethod === "bank_transfer"
                          ? "Bank Transfer"
                          : payment.paymentMethod === "cash"
                          ? "Cash"
                          : "—"}
                      </td>
                      <td>
                        {payment.recordedBy?.username || "—"}
                      </td>
                      <td>{payment.reference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No payments recorded yet.</p>
          )}

          {totalPages > 1 && (
            <div className="payment-history-pagination">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <p className="loan-interest-disclaimer">
        Payment history is read-only. Payment posting is
        not enabled.
      </p>
    </div>
  );
}
