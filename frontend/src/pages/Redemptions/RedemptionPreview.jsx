import { useEffect, useState } from "react";

import {
  Calculator,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Lock,
  Gem,
} from "lucide-react";

import { apiFetch } from
  "../../../utils/api.js";

const formatAmount = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not calculated";
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return "-";
  }

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Colombo",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
  });
};

const formatStatus = (value) => {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};

function DetailField({ label, value }) {
  return (
    <div className="rd-detail-field">
      <span>{label}</span>

      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function RedemptionPreview({
  loan,
}) {
  const [preview, setPreview] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [reloadKey, setReloadKey] =
    useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadPreview = async () => {
      setLoading(true);
      setError("");
      setPreview(null);

      try {
        const response = await apiFetch(
          `/api/pawn-loans/${encodeURIComponent(
            loan._id
          )}/redemption-preview`,
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
              "Failed to load redemption preview"
          );
        }

        if (!controller.signal.aborted) {
          setPreview(data.preview);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load redemption preview"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => controller.abort();
  }, [loan._id, reloadKey]);

  const handleRefresh = () => {
    setLoading(true);
    setPreview(null);
    setReloadKey((previous) => previous + 1);
  };

  const balance = preview?.balance;
  const settlement = preview?.settlement;
  const overdue = preview?.overdue;
  const interest = preview?.interest;

  const goldItems = Array.isArray(
    preview?.goldItems
  )
    ? preview.goldItems
    : [];

  return (
    <div className="rd-card">
      <div className="rd-section-header">
        <div className="rd-heading">
          <Calculator size={24} />

          <div>
            <h2>Redemption Preview</h2>

            <p>
              Review estimated settlement
              and pledged gold items.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="rd-secondary-btn"
          disabled={loading}
          onClick={handleRefresh}
        >
          <RefreshCw size={16} />
          Refresh Preview
        </button>
      </div>

      {loading && (
        <div
          className="rd-message"
          role="status"
        >
          Calculating redemption preview...
        </div>
      )}

      {error && (
        <div
          className="rd-error"
          role="alert"
        >
          <AlertCircle size={20} />

          <span>{error}</span>
        </div>
      )}

      {!loading && !error && preview && (
        <>
          <div className="rd-subsection">
            <h3>Pawn Loan Information</h3>

            <div className="rd-details-grid">
              <DetailField
                label="Loan Number"
                value={preview.loan?.loanNumber}
              />

              <DetailField
                label="Customer Name"
                value={preview.customer?.fullName}
              />

              <DetailField
                label="Customer Code"
                value={
                  preview.customer?.customerCode
                }
              />

              <DetailField
                label="Loan Status"
                value={formatStatus(
                  preview.loan?.status
                )}
              />

              <DetailField
                label="Issue Date"
                value={formatDate(
                  preview.loan?.issueDate
                )}
              />

              <DetailField
                label="Maturity Date"
                value={formatDate(
                  preview.loan?.maturityDate
                )}
              />

              <DetailField
                label="Settings Version"
                value={
                  preview.loan?.settingsVersion
                }
              />

              <DetailField
                label="Calculation Time"
                value={formatDateTime(
                  preview.calculationDate
                )}
              />

              <DetailField
                label="Redemption Settings"
                value={
                  preview.redemptionSettings
                    ?.configured
                    ? "Snapshot Available"
                    : "Snapshot Not Available"
                }
              />
            </div>
          </div>

          <div className="rd-subsection">
            <h3>Outstanding Loan Balance</h3>

            <div className="rd-details-grid">
              <DetailField
                label="Original Principal"
                value={formatAmount(
                  balance?.originalPrincipal
                )}
              />

              <DetailField
                label="Total Principal Paid"
                value={formatAmount(
                  balance?.totalPrincipalPaid
                )}
              />

              <DetailField
                label="Outstanding Principal"
                value={formatAmount(
                  balance?.outstandingPrincipal
                )}
              />

              <DetailField
                label="Accrued Interest"
                value={formatAmount(
                  balance?.accruedInterest
                )}
              />

              <DetailField
                label="Total Interest Paid"
                value={formatAmount(
                  balance?.totalInterestPaid
                )}
              />

              <DetailField
                label="Outstanding Interest"
                value={formatAmount(
                  balance?.outstandingInterest
                )}
              />

              <DetailField
                label="Interest Method"
                value={formatStatus(
                  interest?.calculationMethod
                )}
              />

              <DetailField
                label="Principal Method"
                value={formatStatus(
                  interest
                    ?.principalCalculationMethod
                )}
              />

              <DetailField
                label="Elapsed Days"
                value={interest?.elapsedDays}
              />

              <DetailField
                label="Charged Months"
                value={
                  interest?.chargedMonths ??
                  "Not applicable"
                }
              />
            </div>
          </div>

          <div className="rd-subsection">
            <h3>Overdue Information</h3>

            <div className="rd-details-grid">
              <DetailField
                label="Overdue Status"
                value={formatStatus(
                  overdue?.overdueStatus
                )}
              />

              <DetailField
                label="Days Overdue"
                value={overdue?.daysOverdue}
              />

              <DetailField
                label="Grace Period Days"
                value={overdue?.gracePeriodDays}
              />

              <DetailField
                label="Days After Grace"
                value={overdue?.daysAfterGrace}
              />

              <DetailField
                label="Penalty Enabled"
                value={
                  overdue?.penaltyEnabled === true
                    ? "Yes"
                    : overdue?.penaltyEnabled === false
                      ? "No"
                      : "Unknown"
                }
              />

              <DetailField
                label="Penalty Amount"
                value={formatAmount(
                  settlement?.penaltyAmount
                )}
              />
            </div>
          </div>

          <div className="rd-total">
            <span>
              Estimated Settlement
              Excluding Penalties
            </span>

            <strong>
              {formatAmount(
                settlement
                  ?.estimatedSettlementExcludingPenalties
              )}
            </strong>

            <small>
              This is not a final settlement
              amount.
            </small>
          </div>

          <div className="rd-subsection">
            <h3 className="rd-gold-heading">
              <Gem size={20} />

              Pledged Gold Items
              ({goldItems.length})
            </h3>

            <div className="rd-table-wrapper">
              <table className="rd-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Type</th>
                    <th>Karat</th>
                    <th>Gross Weight</th>
                    <th>Deduction</th>
                    <th>Net Weight</th>
                    <th>Status</th>
                    <th>Reservation</th>
                  </tr>
                </thead>

                <tbody>
                  {goldItems.map((item) => (
                    <tr key={item._id}>
                      <td>
                        {item.goldItemCode ||
                          "Code Pending"}
                      </td>

                      <td>{item.itemType}</td>

                      <td>{item.karat}</td>

                      <td>
                        {item.grossWeight} g
                      </td>

                      <td>
                        {item.deductionWeight} g
                      </td>

                      <td>
                        {item.netWeight} g
                      </td>

                      <td>
                        {formatStatus(item.status)}
                      </td>

                      <td>
                        <span
                          className={
                            item.reservationValid
                              ? "rd-valid"
                              : "rd-invalid"
                          }
                        >
                          {item.reservationValid
                            ? "Valid"
                            : "Invalid"}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {goldItems.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        No gold items available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rd-subsection">
            <h3>Redemption Eligibility</h3>

            <div className="rd-details-grid">
              <DetailField
                label="Active Loan"
                value={
                  preview.eligibility?.activeLoan
                    ? "Yes"
                    : "No"
                }
              />

              <DetailField
                label="Gold Reservations"
                value={
                  preview.eligibility
                    ?.goldItemReservationsValid
                    ? "Valid"
                    : "Not Validated"
                }
              />

              <DetailField
                label="Existing Redemption"
                value={
                  preview.eligibility
                    ?.existingRedemption === false
                    ? "No"
                    : preview.eligibility
                          ?.existingRedemption === true
                      ? "Yes"
                      : "Unknown"
                }
              />
            </div>
          </div>

          <div className="rd-warnings">
            <div className="rd-warning-heading">
              <ShieldCheck size={20} />

              <strong>
                Important Information
              </strong>
            </div>

            <ul>
              {Array.isArray(preview.warnings) &&
                preview.warnings.map(
                  (warning, index) => (
                    <li key={index}>
                      {warning}
                    </li>
                  )
                )}
            </ul>
          </div>

          <div className="rd-actions">
            <button
              type="button"
              className="rd-primary-btn"
              disabled
            >
              <Lock size={16} />
              Confirm Redemption
            </button>

            <button
              type="button"
              className="rd-secondary-btn"
              disabled
            >
              <Lock size={16} />
              Release Gold
            </button>

            <span>
              Financial posting is disabled.
            </span>
          </div>
        </>
      )}
    </div>
  );
}