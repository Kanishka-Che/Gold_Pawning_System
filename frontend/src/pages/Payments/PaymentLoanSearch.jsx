import { useEffect, useState } from "react";
import { Search, X, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../../../utils/api";
import "./PaymentLoanSearch.scss";

const formatAmount = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(value);

export default function PaymentLoanSearch({
  onLoanSelected,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState(null);
  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] =
    useState(null);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();

    async function searchLoans() {
      setLoading(true);
      setError("");
      setLoans([]);
      setSearched(false);

      try {
        const params = new URLSearchParams({
          search: query.text,
          status: "active",
          page: String(page),
          limit: "10",
        });

        const response = await apiFetch(
          `/api/pawn-loans?${params.toString()}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to search pawn loans."
          );
        }

        if (!controller.signal.aborted) {
          setLoans(data.pawnLoans || []);

          setTotalPages(
            Math.max(1, Number(data.totalPages) || 1)
          );

          setSearched(true);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || "Failed to search pawn loans."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    searchLoans();

    return () => controller.abort();
  }, [query, page]);

  const handleSearch = (event) => {
    event.preventDefault();

    const text = searchInput.trim();

    if (!text) {
      setError("Enter a loan number, NIC, name or code.");
      return;
    }

    setSelectedLoanId(null);
    onLoanSelected?.(null);

    setPage(1);
    setQuery({ text });
  };

  const handleClear = () => {
    setSearchInput("");
    setQuery(null);
    setLoans([]);
    setSelectedLoanId(null);
    setSearched(false);
    setLoading(false);
    setError("");
    setPage(1);
    setTotalPages(1);

    onLoanSelected?.(null);
  };

  const handleSelect = (loan) => {
    if (loan.status !== "active") return;

    setSelectedLoanId(loan._id);
    onLoanSelected?.(loan);
  };

  const changePage = (nextPage) => {
    setSelectedLoanId(null);
    onLoanSelected?.(null);
    setPage(nextPage);
  };

  return (
    <section className="payment-loan-search">
      <div className="pls-heading">
        <Search size={20} />

        <div>
          <h2>Find Pawn Loan</h2>

          <p>
            Search and select an active pawn loan.
          </p>
        </div>
      </div>

      <form
        className="pls-search-form"
        onSubmit={handleSearch}
      >
        <input
          type="text"
          value={searchInput}
          onChange={(event) =>
            setSearchInput(event.target.value)
          }
          placeholder="Loan Number, NIC, Customer Name or Code"
          aria-label="Search active pawn loans"
          maxLength={100}
        />

        <button
          type="submit"
          className="pls-primary"
          disabled={loading}
        >
          <Search size={16} />

          {loading ? "Searching..." : "Search"}
        </button>

        <button
          type="button"
          className="pls-secondary"
          onClick={handleClear}
        >
          <X size={16} />
          Clear
        </button>
      </form>

      {error && (
        <p className="pls-error" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="pls-message">
          Searching active pawn loans...
        </p>
      )}

      {!loading &&
        searched &&
        loans.length === 0 && (
          <div className="pls-empty">
            No active pawn loans found.
          </div>
        )}

      {!loading && loans.length > 0 && (
        <>
          <div className="pls-results">
            {loans.map((loan) => (
              <button
                type="button"
                key={loan._id}
                aria-pressed={
                  selectedLoanId === loan._id
                }
                className={`pls-loan-card ${
                  selectedLoanId === loan._id
                    ? "selected"
                    : ""
                }`}
                onClick={() => handleSelect(loan)}
              >
                <div className="pls-card-top">
                  <strong>{loan.loanNumber}</strong>

                  <span className="pls-active-badge">
                    Active
                  </span>
                </div>

                <div className="pls-customer-name">
                  {loan.customer?.fullName ||
                    "Unknown Customer"}
                </div>

                <div className="pls-customer-code">
                  {loan.customer?.customerCode || "-"}
                </div>

                <div className="pls-card-bottom">
                  <div>
                    <span>Original Principal</span>

                    <strong>
                      {formatAmount(
                        loan.principalAmount
                      )}
                    </strong>
                  </div>

                  {selectedLoanId === loan._id && (
                    <CheckCircle2 size={22} />
                  )}
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pls-pagination">
              <button
                type="button"
                className="pls-secondary"
                disabled={page <= 1 || loading}
                onClick={() => changePage(page - 1)}
              >
                Previous
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="pls-secondary"
                disabled={
                  page >= totalPages || loading
                }
                onClick={() => changePage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}