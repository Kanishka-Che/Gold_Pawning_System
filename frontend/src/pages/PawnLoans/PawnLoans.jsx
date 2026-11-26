
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
const [statusFilter, setStatusFilter] = useState("all");
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [totalLoans, setTotalLoans] = useState(0);
const [searchInput, setSearchInput] = useState("");
const [searchQuery, setSearchQuery] = useState("");


const fetchPawnLoans = async (
  status = "all",
  page = 1,
  search = ""
) => {
  try {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    if (status !== "all") {
      params.set("status", status);
    }

    if (search.trim()) {
  params.set("search", search.trim());
}

    const response = await apiFetch(
      `/api/pawn-loans?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to fetch pawn loans"
      );
    }
const safeTotalPages = Math.max(
  1,
  Number(data.totalPages) || 1
);

setTotalPages(safeTotalPages);
setTotalLoans(Number(data.total) || 0);

if (page > safeTotalPages) {
  setCurrentPage(safeTotalPages);
  return;
}

setPawnLoans(data.pawnLoans);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};


useEffect(() => {
  fetchPawnLoans(statusFilter, currentPage, searchQuery);
}, [statusFilter, currentPage, searchQuery]);


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

  fetchPawnLoans(
    statusFilter,
    currentPage,
    searchQuery
  );
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


<div className="pawn-loan-filters">
  <label htmlFor="loanStatusFilter">Filter by Status:</label>

  <select
    id="loanStatusFilter"
    value={statusFilter}
   onChange={(e) => {
  setCurrentPage(1);
  setStatusFilter(e.target.value);
}}
  >
    <option value="all">All Loans</option>
    <option value="draft">Draft</option>
    <option value="active">Active</option>
    <option value="redeemed">Redeemed</option>
    <option value="cancelled">Cancelled</option>
    <option value="closed">Closed</option>
  </select>
</div>

<form
  className="pawn-loan-search"
  onSubmit={(e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchQuery(searchInput.trim());
  }}
>
  <input
    type="text"
    placeholder="Search Loan Number or Customer NIC"
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
    maxLength={100}
  />

  <button type="submit">
    Search
  </button>

  <button
    type="button"
    className="clear-search-btn"
    onClick={() => {
      setSearchInput("");
      setSearchQuery("");
      setCurrentPage(1);
    }}
  >
    Clear
  </button>
</form>


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
                <td>
  <span className={`loan-status-badge ${loan.status}`}>
    {loan.status}
  </span>
</td>
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
    onCancelled={(cancelledLoanId) => {
      setPawnLoans((previous) =>
        previous.map((loan) =>
          loan._id === cancelledLoanId
            ? { ...loan, status: "cancelled" }
            : loan
        )
      );

      fetchPawnLoans(
        statusFilter,
        currentPage,
        searchQuery
      );
    }}
    onActivated={(activatedLoanId) => {
      setPawnLoans((previous) =>
        previous.map((loan) =>
          loan._id === activatedLoanId
            ? { ...loan, status: "active" }
            : loan
        )
      );

      fetchPawnLoans(
        statusFilter,
        currentPage,
        searchQuery
      );
    }}
  />
)}


<div className="pawn-loan-pagination">
  <span>
    Total Loans: {totalLoans} | Page{" "}
    {totalLoans === 0 ? 0 : currentPage} of {totalLoans === 0 ? 0 : totalPages}
  </span>

  <div className="pagination-buttons">
    <button
      type="button"
      disabled={loading || currentPage <= 1}
      onClick={() => setCurrentPage((p) => p - 1)}
    >
      Previous
    </button>

    <button
      type="button"
      disabled={loading || currentPage >= totalPages}
      onClick={() => setCurrentPage((p) => p + 1)}
    >
      Next
    </button>
  </div>
</div>

    </div>
  );
}
