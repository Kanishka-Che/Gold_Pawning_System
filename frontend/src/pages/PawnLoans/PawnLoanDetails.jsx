
import { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api";

export default function PawnLoanDetails({ loanId, onClose }) {
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loanId) return;

    const controller = new AbortController();

    const loadLoan = async () => {
      try {
        setLoading(true);
        setError("");
        setLoan(null);

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

    return () => controller.abort();
  }, [loanId]);

  const formatAmount = (value) =>
    typeof value === "number"
      ? new Intl.NumberFormat("en-LK", {
          style: "currency",
          currency: "LKR",
        }).format(value)
      : "—";

  const formatDate = (value) =>
    value && !Number.isNaN(new Date(value).getTime())
      ? new Date(value).toLocaleDateString("en-LK")
      : "—";

  return (
    <section className="pawn-loan-details">
      <div className="pawn-loan-details__header">
        <h2>Pawn Loan Details</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <p>Loading loan details...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && loan && (
        <>
          <h3>Loan Information</h3>
          <p><strong>Loan Number:</strong> {loan.loanNumber}</p>
          <p><strong>Status:</strong> {loan.status}</p>
          <p>
            <strong>Principal Amount:</strong>{" "}
            {formatAmount(loan.principalAmount)}
          </p>
          <p>
            <strong>Issue Date:</strong>{" "}
            {formatDate(loan.issueDate)}
          </p>
          <p>
            <strong>Maturity Date:</strong>{" "}
            {formatDate(loan.maturityDate)}
          </p>

          <h3>Customer Information</h3>
          <p>
            <strong>Customer Code:</strong>{" "}
            {loan.customer?.customerCode || "—"}
          </p>
          <p>
            <strong>Customer Name:</strong>{" "}
            {loan.customer?.fullName || "—"}
          </p>

          <h3>Gold Items</h3>
          {loan.goldItems?.length ? (
            <ul>
              {loan.goldItems.map((item) => (
                <li key={item._id}>
                  {item.itemType} — {item.karat} —{" "}
                  Net Weight: {item.netWeight} g
                </li>
              ))}
            </ul>
          ) : (
            <p>No gold items found.</p>
          )}

          <h3>Audit Information</h3>
          <p>
            <strong>Created At:</strong>{" "}
            {formatDate(loan.createdAt)}
          </p>
          <p>
            <strong>Created By:</strong>{" "}
            {loan.createdBy?.username || "—"}
          </p>
        </>
      )}
    </section>
  );
}
