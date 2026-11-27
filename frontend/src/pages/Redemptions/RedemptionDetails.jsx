import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";
import RedemptionReceiptPreview from
  "./RedemptionReceiptPreview.jsx";
import {
  ReceiptText,
  X,
  RefreshCw,
  Printer,
  AlertCircle,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatStatus,
} from "./redemptionFormatters.js";

function DetailField({ label, value }) {
  return (
    <div className="rd-modal-field">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function RedemptionDetails({
  redemptionId,
  onClose,
}) {
  const dialogRef = useRef(null);

  const [redemption, setRedemption] =
    useState(null);

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
    const controller = new AbortController();

    const loadDetails = async () => {
     setLoading(true);
setError("");
setRedemption(null);
setShowReceiptPreview(false);

      try {
        const response = await apiFetch(
          `/api/pawn-redemptions/${encodeURIComponent(
            redemptionId
          )}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.redemption
        ) {
          throw new Error(
            data.message ||
              "Failed to load redemption details"
          );
        }

        if (!controller.signal.aborted) {
          setRedemption(data.redemption);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load redemption details"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDetails();

    return () => controller.abort();
  }, [redemptionId, reloadKey]);

  const goldItems = Array.isArray(
    redemption?.releasedGoldItems
  )
    ? redemption.releasedGoldItems
    : [];

  return (
  <>
    {createPortal(
      <dialog
      ref={dialogRef}
      className="rd-details-dialog"
      aria-labelledby="rd-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="rd-modal-header">
        <div>
          <ReceiptText size={25} />

          <h2 id="rd-details-title">
            Redemption Details
          </h2>
        </div>

        <button
          type="button"
          className="rd-modal-close"
          onClick={onClose}
          aria-label="Close redemption details"
        >
          <X size={22} />
        </button>
      </div>

      <div className="rd-modal-body">
        {loading && (
          <p role="status">
            Loading redemption details...
          </p>
        )}

        {error && (
          <div className="rd-modal-error" role="alert">
            <AlertCircle size={20} />

            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setReloadKey(
                  (previous) => previous + 1
                )
              }
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && redemption && (
          <>
            <section className="rd-modal-section">
              <h3>Redemption Information</h3>

              <div className="rd-modal-grid">
                <DetailField
                  label="Redemption ID"
                  value={redemption._id}
                />

                <DetailField
                  label="Redeemed Date & Time"
                  value={formatDateTime(
                    redemption.redeemedAt
                  )}
                />

                <DetailField
                  label="Recorded By"
                  value={
                    redemption.redeemedBy?.username
                  }
                />

                <DetailField
                  label="Settings Version"
                  value={redemption.settingsVersion}
                />
              </div>
            </section>

            <section className="rd-modal-section">
              <h3>Pawn Loan & Customer</h3>

              <div className="rd-modal-grid">
                <DetailField
                  label="Loan Number"
                  value={
                    redemption.pawnLoan?.loanNumber
                  }
                />

                <DetailField
                  label="Current Loan Status"
                  value={formatStatus(
                    redemption.pawnLoan?.status
                  )}
                />

                <DetailField
                  label="Customer Name"
                  value={
                    redemption.pawnLoan
                      ?.customer?.fullName
                  }
                />

                <DetailField
                  label="Customer Code"
                  value={
                    redemption.pawnLoan
                      ?.customer?.customerCode
                  }
                />

                <DetailField
                  label="Issue Date"
                  value={formatDate(
                    redemption.pawnLoan?.issueDate
                  )}
                />

                <DetailField
                  label="Maturity Date"
                  value={formatDate(
                    redemption.pawnLoan?.maturityDate
                  )}
                />
              </div>
            </section>

            <section className="rd-modal-section">
              <h3>Settlement Information</h3>

              <div className="rd-modal-grid">
                <DetailField
                  label="Principal Settled"
                  value={formatAmount(
                    redemption.principalSettled
                  )}
                />

                <DetailField
                  label="Interest Settled"
                  value={formatAmount(
                    redemption.interestSettled
                  )}
                />

                <DetailField
                  label="Penalty Settled"
                  value={formatAmount(
                    redemption.penaltySettled
                  )}
                />
              </div>

              <div className="rd-modal-total">
                <span>Total Settlement</span>

                <strong>
                  {formatAmount(
                    redemption.totalSettled
                  )}
                </strong>
              </div>
            </section>

            <section className="rd-modal-section">
              <h3>
                Recorded Released Gold Items
                ({goldItems.length})
              </h3>

              <div className="rd-modal-table-wrapper">
                <table className="rd-modal-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Type</th>
                      <th>Karat</th>
                      <th>Net Weight</th>
                      <th>Current Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {goldItems.map((item, index) => (
                      <tr key={item?._id ?? index}>
                        <td>
                          {item?.goldItemCode ||
                            "Unavailable"}
                        </td>

                        <td>
                          {item?.itemType ?? "-"}
                        </td>

                        <td>
                          {item?.karat ?? "-"}
                        </td>

                        <td>
                          {item?.netWeight != null
                            ? `${item.netWeight} g`
                            : "-"}
                        </td>

                        <td>
                          {formatStatus(item?.status)}
                        </td>
                      </tr>
                    ))}

                    {goldItems.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          No gold item details
                          available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rd-modal-section">
              <h3>Notes</h3>

              <p className="rd-modal-notes">
                {redemption.notes ||
                  "No additional notes."}
              </p>
            </section>

            <div className="rd-modal-notice">
              This is an existing redemption record.
              Customer, loan and gold item details
              reflect current database information.
              Viewing this record does not release
              any gold items.
            </div>
          </>
        )}
      </div>

      <div className="rd-modal-footer">
        <button
          type="button"
          className="rd-modal-secondary"
          onClick={onClose}
        >
          Close
        </button>

        <button
  type="button"
  className="rd-modal-primary"
  disabled={
    loading ||
    Boolean(error) ||
    !redemption
  }
  onClick={() =>
    setShowReceiptPreview(true)
  }
>
  <Printer size={17} />
  Print Receipt
</button>
      </div>
          </dialog>,
      document.body
    )}

    {showReceiptPreview &&
      !loading &&
      !error &&
      redemption && (
        <RedemptionReceiptPreview
          key={redemption._id}
          redemption={redemption}
          onClose={() =>
            setShowReceiptPreview(false)
          }
        />
      )}
  </>
);
}