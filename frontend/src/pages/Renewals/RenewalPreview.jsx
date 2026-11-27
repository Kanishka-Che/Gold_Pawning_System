import { useEffect, useState } from "react";

import {
  CalendarClock,
  RefreshCw,
  Lock,
  AlertTriangle,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

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
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(date);
};

const formatOverdueStatus = (status) => {
  const labels = {
    current: "Current",
    grace_period: "Grace Period",
    overdue: "Overdue",
    not_applicable: "Not Applicable",
  };

  return labels[status] ?? "Unknown";
};

function DetailField({ label, value }) {
  return (
    <div className="rn-detail-field">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function RenewalPreview({ loan }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loanId = loan?._id;

  useEffect(() => {
    if (!loanId) return;

    const controller = new AbortController();

    async function loadPreview() {
      setLoading(true);
      setError("");
      setPreview(null);

      try {
        const response = await apiFetch(
          `/api/pawn-loans/${encodeURIComponent(
            loanId
          )}/renewal-preview`,
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
          !data.preview
        ) {
          throw new Error(
            data?.message ||
              "Failed to calculate renewal preview."
          );
        }

        const result = data.preview;

        if (
          result.pawnLoanId !== loanId ||
          result.isPreview !== true ||
          result.renewalPostingEnabled !== false ||
          !result.balance ||
          !result.renewalRules ||
          !result.estimatedPayment ||
          !result.maturityDateOptions ||
          !result.overdue
        ) {
          throw new Error(
            "Invalid renewal preview response."
          );
        }

        if (!controller.signal.aborted) {
          setPreview(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to calculate renewal preview."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => controller.abort();
  }, [loanId, reloadKey]);

  const handleRefresh = () => {
    setPreview(null);
    setError("");
    setLoading(true);

    setReloadKey((previous) => previous + 1);
  };

  return (
    <section className="rn-card">
      <div className="rn-section-header">
        <div className="rn-heading">
          <CalendarClock size={23} />

          <div>
            <h2>Renewal Calculation Preview</h2>

            <p>
              Review the estimated renewal
              requirements.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="rn-secondary-btn"
          disabled={loading}
          onClick={handleRefresh}
        >
          <RefreshCw size={16} />

          {loading ? "Calculating..." : "Refresh"}
        </button>
      </div>

      <div className="rn-details-grid">
        <DetailField
          label="Loan Number"
          value={loan.loanNumber}
        />

        <DetailField
          label="Customer Name"
          value={loan.customer?.fullName}
        />

        <DetailField
          label="Customer Code"
          value={loan.customer?.customerCode}
        />

        <DetailField
          label="Loan Status"
          value={preview?.loanStatus ?? loan.status}
        />
      </div>

      {loading && (
        <div className="rn-message" role="status">
          Calculating loan renewal preview...
        </div>
      )}

      {error && (
        <div className="rn-error" role="alert">
          <AlertTriangle size={19} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && preview && (
        <>
          <div className="rn-subsection">
            <h3>Outstanding Loan Balance</h3>

            <div className="rn-details-grid">
              <DetailField
                label="Original Principal"
                value={formatAmount(
                  preview.balance.originalPrincipal
                )}
              />

              <DetailField
                label="Principal Paid"
                value={formatAmount(
                  preview.balance.totalPrincipalPaid
                )}
              />

              <DetailField
                label="Outstanding Principal"
                value={formatAmount(
                  preview.balance.outstandingPrincipal
                )}
              />

              <DetailField
                label="Accrued Interest"
                value={formatAmount(
                  preview.balance.accruedInterest
                )}
              />

              <DetailField
                label="Interest Paid"
                value={formatAmount(
                  preview.balance.totalInterestPaid
                )}
              />

              <DetailField
                label="Outstanding Interest"
                value={formatAmount(
                  preview.balance.outstandingInterest
                )}
              />

              <DetailField
                label="Combined Balance (Estimate)"
                value={formatAmount(
                  preview.balance.combinedBalance
                )}
              />

              <DetailField
                label="Calculated At"
                value={formatDateTime(
                  preview.calculationDate
                )}
              />
            </div>
          </div>

          <div className="rn-subsection">
            <h3>Renewal Rules</h3>

            <div className="rn-details-grid">
              <DetailField
                label="Renewal Enabled"
                value={
                  preview.renewalRules.enabled
                    ? "Yes"
                    : "No"
                }
              />

              <DetailField
                label="Renewal Duration"
                value={`${preview.renewalRules.durationMonths} Months`}
              />

              <DetailField
                label="Full Interest Settlement"
                value={
                  preview.renewalRules
                    .requireInterestSettlement
                    ? "Required"
                    : "Not Required"
                }
              />

              <DetailField
                label="Renewal Fee"
                value={formatAmount(
                  preview.renewalRules.renewalFee
                )}
              />

              <DetailField
                label="Loan Settings Version"
                value={preview.settingsVersion}
              />
            </div>
          </div>

          <div className="rn-subsection">
            <h3>Maturity & Overdue Information</h3>

            <div className="rn-details-grid">
              <DetailField
                label="Current Maturity Date"
                value={formatDate(
                  preview.currentMaturityDate
                )}
              />

              <DetailField
                label="Overdue Status"
                value={formatOverdueStatus(
                  preview.overdue.overdueStatus
                )}
              />

              <DetailField
                label="Days Overdue"
                value={preview.overdue.daysOverdue}
              />

              <DetailField
                label="Grace Period"
                value={`${preview.overdue.gracePeriodDays} Days`}
              />

              <DetailField
                label="Days After Grace Period"
                value={preview.overdue.daysAfterGrace}
              />
            </div>
          </div>

          <div className="rn-subsection">
            <h3>Proposed Maturity Date Options</h3>

            <div className="rn-date-options">
              <div className="rn-date-option">
                <span>From Current Maturity Date</span>

                <strong>
                  {formatDate(
                    preview.maturityDateOptions
                      .fromCurrentMaturityDate?.date
                  )}
                </strong>

                <small
                  className={
                    preview.maturityDateOptions
                      .fromCurrentMaturityDate
                      ?.validExtension
                      ? "rn-valid"
                      : "rn-invalid"
                  }
                >
                  {preview.maturityDateOptions
                    .fromCurrentMaturityDate
                    ?.validExtension
                    ? "Valid date extension"
                    : "Invalid date extension"}
                </small>
              </div>

              <div className="rn-date-option">
                <span>From Renewal Date</span>

                <strong>
                  {formatDate(
                    preview.maturityDateOptions
                      .fromRenewalDate?.date
                  )}
                </strong>

                <small
                  className={
                    preview.maturityDateOptions
                      .fromRenewalDate?.validExtension
                      ? "rn-valid"
                      : "rn-invalid"
                  }
                >
                  {preview.maturityDateOptions
                    .fromRenewalDate?.validExtension
                    ? "Valid date extension"
                    : "Invalid date extension"}
                </small>
              </div>
            </div>

            <div className="rn-notice">
              The renewal start date method has
              not been confirmed. Both dates are
              displayed for review only.
            </div>
          </div>

          <div className="rn-subsection">
            <h3>Estimated Renewal Payment</h3>

            <div className="rn-details-grid">
              <DetailField
                label="Outstanding Interest"
                value={formatAmount(
                  preview.estimatedPayment
                    .outstandingInterest
                )}
              />

              <DetailField
                label="Required Interest Settlement"
                value={formatAmount(
                  preview.estimatedPayment
                    .requiredInterestSettlement
                )}
              />

              <DetailField
                label="Renewal Fee"
                value={formatAmount(
                  preview.estimatedPayment.renewalFee
                )}
              />

              <DetailField
                label="Estimated Remaining Interest"
                value={formatAmount(
                  preview.estimatedPayment
                    .remainingInterestAtMinimumPayment
                )}
              />
            </div>

            <div className="rn-total">
              <span>
                Estimated Minimum Renewal Payment
              </span>

              <strong>
                {formatAmount(
                  preview.estimatedPayment
                    .minimumRequiredPayment
                )}
              </strong>

              <small>
                Not a final payable amount.
              </small>
            </div>
          </div>

          {preview.penaltyEnabled && (
            <div className="rn-error" role="alert">
              <AlertTriangle size={19} />

              <span>
                Overdue penalties are enabled for
                this loan but are not included
                in this estimate.
              </span>
            </div>
          )}

          <div className="rn-notice">
            This preview does not change the loan,
            record a payment or extend its maturity
            date. Overdue penalties are excluded.
          </div>
        </>
      )}

      <div className="rn-actions">
        <button
          type="button"
          className="rn-primary-btn"
          disabled
        >
          <Lock size={17} />
          Confirm Renewal
        </button>

        <span>
          Actual renewal posting is disabled.
        </span>
      </div>
    </section>
  );
}