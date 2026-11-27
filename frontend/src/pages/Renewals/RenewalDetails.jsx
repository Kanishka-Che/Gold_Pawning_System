import { useEffect, useRef, useState } from "react";

import {
  CalendarClock,
  X,
  RefreshCw,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import {
  formatAmount,
  formatDate,
  formatDateTime,
} from "./renewalFormatters.js";

import "./RenewalDetails.scss";

function DetailField({ label, value }) {
  return (
    <div className="rd-field">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function RenewalDetails({
  renewalId,
  onClose,
}) {
  const dialogRef = useRef(null);

  const [renewal, setRenewal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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
    const controller = new AbortController();

    async function loadRenewal() {
      setLoading(true);
      setError("");
      setRenewal(null);

      try {
        const response = await apiFetch(
          `/api/pawn-renewals/${encodeURIComponent(
            renewalId
          )}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          !data?.success ||
          !data.renewal ||
          data.renewal._id !== renewalId
        ) {
          throw new Error(
            data?.message ||
              "Failed to load renewal details."
          );
        }

        if (!controller.signal.aborted) {
          setRenewal(data.renewal);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load renewal details."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRenewal();

    return () => controller.abort();
  }, [renewalId, reloadKey]);

  return (
    <dialog
      ref={dialogRef}
      className="renewal-details-dialog"
      aria-labelledby="renewal-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="rd-header">
        <div className="rd-heading">
          <CalendarClock size={24} />

          <div>
            <h2 id="renewal-details-title">
              Renewal Details
            </h2>

            <p>Recorded pawn loan renewal</p>
          </div>
        </div>

        <button
          type="button"
          className="rd-close"
          aria-label="Close renewal details"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>

      <div className="rd-body">
        {loading && (
          <p className="rd-message" role="status">
            Loading renewal details...
          </p>
        )}

        {error && (
          <div className="rd-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="rd-button"
              onClick={() => {
                setLoading(true);
                setReloadKey((value) => value + 1);
              }}
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && renewal && (
          <>
            <section className="rd-section">
              <h3>Renewal Information</h3>

              <div className="rd-grid">
                <DetailField
                  label="Renewal ID"
                  value={renewal._id}
                />

                <DetailField
                  label="Renewed At"
                  value={formatDateTime(
                    renewal.renewedAt
                  )}
                />

                <DetailField
                  label="Renewed By"
                  value={renewal.renewedBy?.username}
                />

                <DetailField
                  label="Loan Settings Version"
                  value={renewal.settingsVersion}
                />
              </div>
            </section>

            <section className="rd-section">
              <h3>Pawn Loan & Customer</h3>

              <div className="rd-grid">
                <DetailField
                  label="Loan Number"
                  value={renewal.pawnLoan?.loanNumber}
                />

                <DetailField
                  label="Current Loan Status"
                  value={renewal.pawnLoan?.status}
                />

                <DetailField
                  label="Customer Name"
                  value={
                    renewal.pawnLoan?.customer?.fullName
                  }
                />

                <DetailField
                  label="Customer Code"
                  value={
                    renewal.pawnLoan?.customer
                      ?.customerCode
                  }
                />
              </div>
            </section>

            <section className="rd-section">
              <h3>Maturity Date Extension</h3>

              <div className="rd-grid">
                <DetailField
                  label="Previous Maturity Date"
                  value={formatDate(
                    renewal.previousMaturityDate
                  )}
                />

                <DetailField
                  label="New Maturity Date"
                  value={formatDate(
                    renewal.newMaturityDate
                  )}
                />
              </div>
            </section>

            <section className="rd-section">
              <h3>Recorded Renewal Payment</h3>

              <div className="rd-grid">
                <DetailField
                  label="Interest Settled"
                  value={formatAmount(
                    renewal.interestSettled
                  )}
                />

                <DetailField
                  label="Renewal Fee Paid"
                  value={formatAmount(
                    renewal.renewalFeePaid
                  )}
                />
              </div>
            </section>

            <section className="rd-section">
              <h3>Notes</h3>

              <div className="rd-notes">
                {renewal.notes || "No notes recorded."}
              </div>
            </section>

            <div className="rd-notice">
              This is a read-only renewal record.
              Customer information and current loan
              status reflect current records.
            </div>
          </>
        )}
      </div>

      <div className="rd-footer">
        <button
          type="button"
          className="rd-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}