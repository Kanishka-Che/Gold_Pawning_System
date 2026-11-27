
import { useEffect, useRef, useState } from "react";

import {
  ReceiptText,
  X,
  Printer,
  RefreshCw,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";
import PaymentReceiptPreview from "./PaymentReceiptPreview.jsx";
import "./PaymentDetails.scss";

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

function DetailField({ label, value }) {
  return (
    <div className="pd-field">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function PaymentDetails({
  paymentId,
  onClose,
}) {
  const dialogRef = useRef(null);

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showReceiptPreview, setShowReceiptPreview] =
  useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!paymentId) return;

    const controller = new AbortController();

    async function loadPayment() {
      setLoading(true);
      setError("");
      setPayment(null);

      try {
        const response = await apiFetch(
          `/api/pawn-payments/${encodeURIComponent(paymentId)}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => null);

        if (
          !response.ok ||
          !data?.success ||
          !data.payment
        ) {
          throw new Error(
            data?.message ||
              "Failed to load payment details."
          );
        }

        if (!controller.signal.aborted) {
          setPayment(data.payment);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load payment details."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPayment();

    return () => controller.abort();
  }, [paymentId, reloadKey]);

 return (
  <>
    <dialog
      ref={dialogRef}
      className="payment-details-dialog"
      aria-labelledby="payment-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="pd-header">
        <div className="pd-heading">
          <ReceiptText size={25} />

          <div>
            <h2 id="payment-details-title">
              Payment Details
            </h2>

            <p>View recorded payment information.</p>
          </div>
        </div>

        <button
          type="button"
          className="pd-close-btn"
          aria-label="Close payment details"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>

      <div className="pd-content" aria-busy={loading}>
        {loading && (
          <p role="status" className="pd-message">
            Loading payment details...
          </p>
        )}

        {error && (
          <div className="pd-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="pd-secondary-btn"
              onClick={() =>
                setReloadKey((value) => value + 1)
              }
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {!loading && payment && (
          <>
            <div className="pd-record-notice">
              Recorded Payment
            </div>

            <section className="pd-section">
              <h3>Payment Information</h3>

              <div className="pd-grid">
                <DetailField
                  label="Payment ID"
                  value={payment._id}
                />

                <DetailField
                  label="Payment Date & Time"
                  value={formatDate(payment.paidAt)}
                />

                <DetailField
                  label="Payment Method"
                  value={formatMethod(
                    payment.paymentMethod
                  )}
                />

                <DetailField
                  label="Recorded By"
                  value={
                    payment.recordedBy?.username ||
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Payment Reference"
                  value={payment.reference || "-"}
                />
              </div>
            </section>

            <section className="pd-section">
              <h3>Pawn Loan & Customer</h3>

              <div className="pd-grid">
                <DetailField
                  label="Pawn Loan Number"
                  value={
                    payment.pawnLoan?.loanNumber ||
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Current Loan Status"
                  value={
                    payment.pawnLoan?.status ||
                    "Unavailable"
                  }
                />

                <DetailField
                  label="Customer Name"
                  value={
                    payment.pawnLoan?.customer
                      ?.fullName || "Unavailable"
                  }
                />

                <DetailField
                  label="Customer Code"
                  value={
                    payment.pawnLoan?.customer
                      ?.customerCode || "Unavailable"
                  }
                />
              </div>
            </section>

            <section className="pd-section">
              <h3>Payment Allocation</h3>

              <div className="pd-amount-grid">
                <DetailField
                  label="Total Payment"
                  value={formatAmount(payment.amount)}
                />

                <DetailField
                  label="Interest Paid"
                  value={formatAmount(
                    payment.interestPaid
                  )}
                />

                <DetailField
                  label="Principal Paid"
                  value={formatAmount(
                    payment.principalPaid
                  )}
                />
              </div>

              <div className="pd-total">
                <span>Total Received</span>

                <strong>
                  {formatAmount(payment.amount)}
                </strong>
              </div>
            </section>

            <div className="pd-readonly-notice">
              This payment record is read-only.
              Customer information and loan status
              reflect current records.
            </div>
          </>
        )}
      </div>

      <div className="pd-footer">
        <button
          type="button"
          className="pd-secondary-btn"
          onClick={onClose}
        >
          Close
        </button>

        <button
  type="button"
  className="pd-primary-btn"
  disabled={loading || Boolean(error) || !payment}
  onClick={() => setShowReceiptPreview(true)}
>
  <Printer size={18} />
  Print Receipt
</button>
      </div>
       </dialog>

    {showReceiptPreview && payment && (
      <PaymentReceiptPreview
        key={payment._id}
        payment={payment}
        onClose={() =>
          setShowReceiptPreview(false)
        }
      />
    )}
  </>
);
}
