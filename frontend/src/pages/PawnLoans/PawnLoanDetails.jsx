
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../utils/api";
import PaymentHistory from "./PaymentHistory.jsx";
import PawnTicketPreview from "./PawnTicketPreview.jsx";

export default function PawnLoanDetails({
  loanId,
  onClose,
  onCancelled,
  onActivated,
}) {
  const [loan, setLoan] = useState(null);
  const [showTicketPreview, setShowTicketPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [activating, setActivating] = useState(false);
const [activationMessage, setActivationMessage] = useState("");
const [interestLoading, setInterestLoading] = useState(false);
const [interestPreview, setInterestPreview] = useState(null);
const [interestError, setInterestError] = useState("");
const interestRequestRef = useRef(null);

  useEffect(() => {
    if (!loanId) return;

    const controller = new AbortController();

    const loadLoan = async () => {
      try {
        

setLoading(true);
setError("");
setCancelMessage("");
setActivationMessage("");
setInterestPreview(null);
setInterestError("");
setInterestLoading(false);
setLoan(null);
setShowTicketPreview(false);



        const response = await apiFetch(
          `/api/pawn-loans/${loanId}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load pawn loan details."
          );
        }

        if (!controller.signal.aborted) {
          setLoan(data.pawnLoan);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Something went wrong.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadLoan();

    return () => {
  controller.abort();
  interestRequestRef.current?.abort();
};
  }, [loanId]);

const formatAmount = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "—";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

  const formatDate = (value) =>
    value && !Number.isNaN(new Date(value).getTime())
      ? new Date(value).toLocaleDateString("en-LK")
      : "—";

  const handleCancelLoan = async () => {
    if (!loan || loan.status !== "draft" || cancelling) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to cancel draft loan ${loan.loanNumber}?`
    );

    if (!confirmed) return;

    try {
      setCancelling(true);
      setError("");
      setCancelMessage("");

      const response = await apiFetch(
        `/api/pawn-loans/${loan._id}/cancel`,
        { method: "PATCH" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to cancel pawn loan."
        );
      }

      setCancelMessage(
        "Draft pawn loan cancelled successfully."
      );

      setLoan((previous) => ({
        ...previous,
        status: "cancelled",
      }));

      onCancelled?.(loan._id);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setCancelling(false);
    }
  };


const handleActivateLoan = async () => {
  if (
    !loan ||
    loan.status !== "draft" ||
    activating ||
    cancelling
  ) {
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to activate loan ${loan.loanNumber}?\n\n` +
    "This will change the loan status to ACTIVE and pledge its gold items."
  );

  if (!confirmed) return;

  try {
    setActivating(true);
    setError("");
    setActivationMessage("");
    setCancelMessage("");

    const response = await apiFetch(
      `/api/pawn-loans/${loan._id}/activate`,
      { method: "PATCH" }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to activate pawn loan."
      );
    }

    setLoan((previous) => ({
      ...previous,
      ...data.pawnLoan,
      status: "active",
    }));

    setActivationMessage(
      "Pawn loan activated successfully."
    );

    onActivated?.(loan._id);
  } catch (err) {
    setError(err.message || "Something went wrong.");
  } finally {
    setActivating(false);
  }
};



const handleInterestPreview = async () => {
  if (!loan || loan.status !== "active" || interestLoading) {
    return;
  }

  const controller = new AbortController();
  interestRequestRef.current = controller;

  try {
    setInterestLoading(true);
    setInterestError("");
    setInterestPreview(null);

    const response = await apiFetch(
      `/api/pawn-loans/${loan._id}/interest-preview`,
      { signal: controller.signal }
    );

    const data = await response.json();

    if (controller.signal.aborted) return;

    if (!response.ok || !data.success) {
      if (data.code === "INTEREST_RULE_NOT_SUPPORTED") {
        setInterestError(
          data.message ||
          "Interest preview is unavailable because this loan uses an unsupported interest rule."
        );
        return;
      }

      throw new Error(
        data.message || "Failed to calculate interest preview."
      );
    }

    setInterestPreview(data.preview);
  } catch (err) {
    if (!controller.signal.aborted) {
      setInterestError(
        err.message || "Failed to load interest preview."
      );
    }
  } finally {
    if (interestRequestRef.current === controller) {
      interestRequestRef.current = null;
      setInterestLoading(false);
    }
  }
};



  return (
    <section className="pawn-loan-details">
      <div className="pawn-loan-details__header">
        <div>
          <span className="loan-details-subtitle">
            PAWN LOAN DETAILS
          </span>

          <h2>
            {loan?.loanNumber || "Pawn Loan Details"}
          </h2>
        </div>

        
<div className="pawn-loan-details__header-actions">
  
<button
  type="button"
  onClick={() => setShowTicketPreview(true)}
  disabled={!loan || loading}
>
  Print Preview
</button>


  <button type="button" onClick={onClose}>
    Close
  </button>
</div>

      </div>

      {loading && <p>Loading loan details...</p>}

      {error && (
        <p role="alert" className="loan-error-message">
          {error}
        </p>
      )}

      {cancelMessage && (
        <p className="loan-success-message" role="status">
          {cancelMessage}
        </p>
      )}


{activationMessage && (
  <p className="loan-success-message" role="status">
    {activationMessage}
  </p>
)}


      {!loading && loan && (
        <>
          <div className="loan-details-status">
            <span
              className={`loan-status-badge ${loan.status}`}
            >
              {loan.status}
            </span>
          </div>

          <h3>Loan Information</h3>

          <div className="loan-details-grid">
            <div className="loan-info-card">
              <span>Loan Number</span>
              <strong>{loan.loanNumber}</strong>
            </div>

            <div className="loan-info-card">
              <span>Principal Amount</span>
              <strong>
                {formatAmount(loan.principalAmount)}
              </strong>
            </div>

            <div className="loan-info-card">
              <span>Issue Date</span>
              <strong>{formatDate(loan.issueDate)}</strong>
            </div>

            <div className="loan-info-card">
              <span>Maturity Date</span>
              <strong>{formatDate(loan.maturityDate)}</strong>
            </div>
          </div>

        
{loan.status === "draft" && (
  <div className="loan-details-actions">
    <button
      type="button"
      onClick={handleActivateLoan}
      disabled={activating || cancelling}
      className="activate-loan-btn"
    >
      {activating
        ? "Activating..."
        : "Activate Loan"}
    </button>

    <button
      type="button"
      onClick={handleCancelLoan}
      disabled={activating || cancelling}
      className="cancel-loan-btn"
    >
      {cancelling
        ? "Cancelling..."
        : "Cancel Draft Loan"}
    </button>
  </div>
)}


{loan.status === "active" && (
  <div className="loan-interest-preview">
    <h3>Interest Preview</h3>

    <p>
      Calculate a read-only interest estimate using
      the loan's saved interest settings.
    </p>

    <button
      type="button"
      onClick={handleInterestPreview}
      disabled={interestLoading}
      className="interest-preview-btn"
    >
      {interestLoading
        ? "Calculating..."
        : "Calculate Interest"}
    </button>

    {interestError && (
      <p role="alert" className="loan-error-message">
        {interestError}
      </p>
    )}

   
{interestPreview && (
  <div className="loan-details-grid">
    <div className="loan-info-card">
      <span>Original Principal</span>
      <strong>
        {formatAmount(
          interestPreview.originalPrincipal ??
          interestPreview.principalAmount
        )}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Outstanding Principal</span>
      <strong>
        {formatAmount(
          interestPreview.outstandingPrincipal ??
          interestPreview.principalAmount
        )}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Accrued Interest</span>
      <strong>
        {formatAmount(
          interestPreview.accruedInterest ??
          interestPreview.interestAmount
        )}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Interest Already Paid</span>
      <strong>
        {formatAmount(
          interestPreview.totalInterestPaid
        )}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Outstanding Interest</span>
      <strong>
        {formatAmount(
          interestPreview.outstandingInterest
        )}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Monthly Interest Rate</span>
      <strong>
        {interestPreview.monthlyRate ?? "—"}%
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Calculation Method</span>
      <strong>
        {interestPreview.calculationMethod || "—"}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Principal Calculation Method</span>
      <strong>
        {interestPreview.principalCalculationMethod || "—"}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Elapsed Days</span>
      <strong>
        {interestPreview.elapsedDays ?? "—"}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Charged Months</span>
      <strong>
        {interestPreview.chargedMonths ?? "—"}
      </strong>
    </div>

    <div className="loan-info-card">
      <span>Calculation Date</span>
      <strong>
        {formatDate(interestPreview.calculationDate)}
      </strong>
    </div>
  </div>
)}

    {interestPreview && (
      <p className="loan-interest-disclaimer">
        This is an interest preview only, not a final
        settlement amount.
      </p>
    )}
  </div>
)}

<PaymentHistory
  key={loan._id}
  loanId={loan._id}
/>


          <h3>Customer Information</h3>

          <div className="loan-details-grid">
            <div className="loan-info-card">
              <span>Customer Code</span>
              <strong>
                {loan.customer?.customerCode || "—"}
              </strong>
            </div>

            <div className="loan-info-card">
              <span>Customer Name</span>
              <strong>
                {loan.customer?.fullName || "—"}
              </strong>
            </div>
          </div>

          <h3>Gold Items</h3>

         
{loan.goldItems?.length ? (
  <div className="loan-gold-items">
    {loan.goldItems.map((item, index) => (
      <div
        className="loan-gold-card"
        key={item._id || index}
      >



<p>
  <span>Gold Item Code:</span>{" "}
  <strong>{item.goldItemCode || "Code Pending"}</strong>
</p>

<strong>{item.itemType || "Gold Item"}</strong>


        <p>
          <span>Karat:</span> {item.karat || "—"}
        </p>

        <p>
          <span>Gross Weight:</span>{" "}
          {item.grossWeight ?? "—"} g
        </p>

        <p>
          <span>Deduction Weight:</span>{" "}
          {item.deductionWeight ?? "—"} g
        </p>

        <p>
          <span>Net Weight:</span>{" "}
          {item.netWeight ?? "—"} g
        </p>

        <p>
          <span>Status:</span>{" "}
          <span className={`loan-status-badge ${item.status}`}>
            {item.status || "—"}
          </span>
        </p>

        <p>
          <span>Description:</span>{" "}
          {item.description || "—"}
        </p>
      </div>
    ))}
  </div>
) : (
  <p>No gold items found.</p>
)}


          <h3>Audit Information</h3>

          <div className="loan-details-grid">
            <div className="loan-info-card">
              <span>Created At</span>
              <strong>
                {formatDate(loan.createdAt)}
              </strong>
            </div>

            <div className="loan-info-card">
              <span>Created By</span>
              <strong>
                {loan.createdBy?.username || "—"}
              </strong>
            </div>
          </div>
        </>
      )}

{showTicketPreview && loan && (
  <PawnTicketPreview
    key={loan._id}
    loan={loan}
    onClose={() => setShowTicketPreview(false)}
  />
)}

    </section>
  );
}
