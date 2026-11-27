import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  CalendarClock,
  X,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatClassification,
  formatDays,
  formatBoolean,
} from "./overdueFormatters.js";

function DetailField({ label, value }) {
  return (
    <div className="od-detail-field">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function OverdueDetails({
  loanId,
  onClose,
}) {
  const dialogRef = useRef(null);

  const [data, setData] = useState(null);
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

    async function loadDetails() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await apiFetch(
          `/api/pawn-overdue/${encodeURIComponent(
            loanId
          )}`,
          {
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.pawnLoan
        ) {
          throw new Error(
            result.message ||
              "Failed to load loan details"
          );
        }

        if (!controller.signal.aborted) {
          setData(result);
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

    loadDetails();

    return () => controller.abort();
  }, [loanId, reloadKey]);

  const loan = data?.pawnLoan;

  const goldItems = Array.isArray(
    loan?.goldItems
  )
    ? loan.goldItems
    : [];

  return createPortal(
    <dialog
      ref={dialogRef}
      className="od-details-dialog"
      aria-labelledby="od-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="od-modal-header">
        <div>
          <CalendarClock size={25} />

          <h2 id="od-details-title">
            Loan Monitoring Details
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={23} />
        </button>
      </header>

      <div className="od-modal-body">
        {loading && (
          <p role="status">
            Loading loan details...
          </p>
        )}

        {error && (
          <div className="od-error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              className="od-secondary"
              onClick={() =>
                setReloadKey((value) => value + 1)
              }
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && loan && (
          <>
            <section className="od-modal-section">
              <h3>Loan Information</h3>

              <div className="od-detail-grid">
                <DetailField
                  label="Loan Number"
                  value={loan.loanNumber}
                />

                <DetailField
                  label="Loan Status"
                  value={loan.status}
                />

                <DetailField
                  label="Classification"
                  value={
                    <span
                      className={`od-status ${loan.classification}`}
                    >
                      {formatClassification(
                        loan.classification
                      )}
                    </span>
                  }
                />

                <DetailField
                  label="Issue Date"
                  value={formatDate(
                    loan.issueDate
                  )}
                />

                <DetailField
                  label="Maturity Date"
                  value={formatDate(
                    loan.maturityDate
                  )}
                />

                <DetailField
                  label="Settings Version"
                  value={loan.settingsVersion}
                />
              </div>
            </section>

            <section className="od-modal-section">
              <h3>Customer Information</h3>

              <div className="od-detail-grid">
                <DetailField
                  label="Customer Name"
                  value={loan.customer?.fullName}
                />

                <DetailField
                  label="Customer Code"
                  value={loan.customer?.customerCode}
                />

                <DetailField
                  label="NIC"
                  value={loan.customer?.nic}
                />
              </div>
            </section>

            <section className="od-modal-section">
              <h3>Maturity & Overdue Information</h3>

              <div className="od-detail-grid">
                <DetailField
                  label="Days Until Maturity"
                  value={formatDays(
                    loan.daysUntilMaturity
                  )}
                />

                <DetailField
                  label="Days Overdue"
                  value={formatDays(
                    loan.daysOverdue
                  )}
                />

                <DetailField
                  label="Grace Period"
                  value={formatDays(
                    loan.gracePeriodDays
                  )}
                />

                <DetailField
                  label="Days After Grace Period"
                  value={formatDays(
                    loan.daysAfterGrace
                  )}
                />

                <DetailField
                  label="Remaining Grace Period"
                  value={formatDays(
                    loan.remainingGraceDays
                  )}
                />

                <DetailField
                  label="Calculated At"
                  value={formatDateTime(
                    data.calculationDate
                  )}
                />
              </div>

              {loan.classificationError && (
                <div className="od-error">
                  {loan.classificationError}
                </div>
              )}
            </section>

            <section className="od-modal-section">
              <h3>Principal Balance</h3>

              {loan.balanceError && (
                <div className="od-error">
                  {loan.balanceError}
                </div>
              )}

              <div className="od-detail-grid">
                <DetailField
                  label="Original Principal"
                  value={formatAmount(
                    loan.balance?.originalPrincipal
                  )}
                />

                <DetailField
                  label="Principal Already Paid"
                  value={formatAmount(
                    loan.balance?.totalPrincipalPaid
                  )}
                />
              </div>

              <div className="od-balance-total">
                <span>Outstanding Principal</span>

                <strong>
                  {formatAmount(
                    loan.balance?.outstandingPrincipal
                  )}
                </strong>
              </div>

              <p className="od-muted">
                Excludes interest and penalties.
                This is not the final settlement amount.
              </p>
            </section>

            <section className="od-modal-section">
              <h3>Overdue Penalty Settings</h3>

              <div className="od-detail-grid">
                <DetailField
                  label="Penalty Enabled in Snapshot"
                  value={formatBoolean(
                    loan.penalty?.enabled
                  )}
                />

                <DetailField
                  label="Configured Penalty Rate"
                  value={
                    loan.penalty?.rate == null
                      ? "Not configured"
                      : `${loan.penalty.rate}%`
                  }
                />

                <DetailField
                  label="Penalty Amount"
                  value="Not calculated"
                />

                <DetailField
                  label="Penalty Collection"
                  value="Disabled"
                />
              </div>

              <div className="od-notice">
                <ShieldCheck size={20} />

                <p>
                  Penalty calculation rules must
                  be confirmed before financial
                  transactions can be enabled.
                </p>
              </div>
            </section>

            <section className="od-modal-section">
              <h3>
                Pledged Gold Items ({goldItems.length})
              </h3>

              <div className="od-table-wrapper">
                <table className="od-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Type</th>
                      <th>Karat</th>
                      <th>Gross Weight</th>
                      <th>Net Weight</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {goldItems.map((item, index) => (
                      <tr key={item?._id ?? index}>
                        <td>
                          {item?.goldItemCode ||
                            "Code Pending"}
                        </td>

                        <td>
                          {item?.itemType ?? "-"}
                        </td>

                        <td>
                          {item?.karat ?? "-"}
                        </td>

                        <td>
                          {item?.grossWeight != null
                            ? `${item.grossWeight} g`
                            : "-"}
                        </td>

                        <td>
                          {item?.netWeight != null
                            ? `${item.netWeight} g`
                            : "-"}
                        </td>

                        <td>
                          {item?.status ?? "-"}
                        </td>
                      </tr>
                    ))}

                    {goldItems.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          No gold item details available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="od-modal-footer">
        <button
          type="button"
          className="od-secondary"
          onClick={onClose}
        >
          Close
        </button>
      </footer>
    </dialog>,
    document.body
  );
}