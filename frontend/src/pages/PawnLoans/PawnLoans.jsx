
import { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api";
import GoldItemForm from "./GoldItemForm.jsx";
import CreatePawnLoanForm from "./CreatePawnLoanForm.jsx";
import PawnLoanDetails from "./PawnLoanDetails.jsx";
import "./PawnLoans.scss";

export default function PawnLoans() {
  const [activeForm, setActiveForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [pawnLoans, setPawnLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  const fetchPawnLoans = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        "/api/pawn-loans?page=1&limit=20"
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load pawn loans."
        );
      }

      setPawnLoans(data.pawnLoans);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPawnLoans();
  }, []);

  const handleGoldItemCreated = (goldItem) => {
    setActiveForm(null);
    setMessage(
      `Gold item registered successfully: ${goldItem.itemType}`
    );
  };

  const handlePawnLoanCreated = (loan) => {
    setActiveForm(null);
    setMessage(
      `Draft pawn loan created successfully: ${
        loan.loanNumber || loan._id
      }`
    );
    fetchPawnLoans();
  };

  const formatAmount = (amount) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount);

  return (
    <div className="pawn-loans-page">
      <h1>Pawn Loan Management</h1>
      <p>Manage pawn loans and gold items.</p>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      {!activeForm && (
        <div className="pawn-loans-actions">
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setActiveForm("gold");
            }}
          >
            + Register Gold Item
          </button>

          <button
            type="button"
            onClick={() => {
              setMessage("");
              setActiveForm("loan");
            }}
          >
            + Create Pawn Loan
          </button>
        </div>
      )}

      {activeForm === "gold" && (
        <GoldItemForm
          onCreated={handleGoldItemCreated}
          onCancel={() => setActiveForm(null)}
        />
      )}

      {activeForm === "loan" && (
        <CreatePawnLoanForm
          onCreated={handlePawnLoanCreated}
          onCancel={() => setActiveForm(null)}
        />
      )}

      <h2>Pawn Loans</h2>

      {loading ? (
        <p>Loading pawn loans...</p>
      ) : pawnLoans.length === 0 ? (
        <p>No pawn loans found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Loan Number</th>
              <th>Customer</th>
              <th>Principal Amount</th>
              <th>Status</th>
              <th>Issue Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {pawnLoans.map((loan) => (
              <tr key={loan._id}>
                <td>{loan.loanNumber || "—"}</td>
                <td>
                  {loan.customer?.fullName || "Unknown"}
                </td>
                <td>{formatAmount(loan.principalAmount)}</td>
                <td>{loan.status}</td>
                <td>
                  {loan.issueDate
                    ? new Date(loan.issueDate).toLocaleDateString(
                        "en-LK"
                      )
                    : "Not activated"}
                </td>
                <td>
  <button
    type="button"
    className="view-loan-btn"
    onClick={() => setSelectedLoanId(loan._id)}
  >
    View Details
  </button>
</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedLoanId && (
  <PawnLoanDetails
    loanId={selectedLoanId}
    onClose={() => setSelectedLoanId(null)}
  />
)}
    </div>
  );
}
