import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Lock,
  AlertCircle,
  Wallet,
  RefreshCw,
} from "lucide-react";

import { apiFetch } from "../../../utils/api";
import "./PaymentPreview.scss";

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
  if (!value || Number.isNaN(Date.parse(value))) {
    return "-";
  }

  return new Date(value).toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function PaymentPreview({ loan }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState("cash");

  const [reference, setReference] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestRef = useRef(null);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  const invalidatePreview = () => {
    requestRef.current?.abort();
    requestRef.current = null;

    setPreview(null);
    setError("");
    setLoading(false);
  };

  const handleReset = () => {
    invalidatePreview();

    setAmount("");
    setPaymentMethod("cash");
    setReference("");
  };

  const handleCalculate = async (event) => {
    event.preventDefault();

    invalidatePreview();

    const text = amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
      setError(
        "Enter a valid amount with at most two decimal places."
      );
      return;
    }

    const numericAmount = Number(text);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !Number.isSafeInteger(
        Math.round(numericAmount * 100)
      )
    ) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (!loan?._id || loan.status !== "active") {
      setError("Please select an active pawn loan.");
      return;
    }

    const controller = new AbortController();

    requestRef.current = controller;

    setLoading(true);

    try {
      const response = await apiFetch(
        "/api/pawn-payments/preview",
        {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            pawnLoanId: loan._id,
            amount: numericAmount,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            "Failed to calculate payment preview."
        );
      }

      if (
        !data.preview ||
        data.preview.pawnLoanId !== String(loan._id) ||
        data.preview.isPreview !== true ||
        data.preview.paymentPostingEnabled !== false
      ) {
        throw new Error("Invalid payment preview response.");
      }

      if (!controller.signal.aborted) {
        setPreview(data.preview);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err.message ||
            "Failed to calculate payment preview."
        );
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const balance = preview?.balanceBeforePayment;
  const allocation = preview?.allocation;
  const rules = preview?.paymentRules;

  return (
    <section className="payment-preview">
      <div className="pp-heading">
        <Calculator size={22} />

        <div>
          <h2>Payment Calculation Preview</h2>
          <p>
            Calculate payment allocation without
            recording a transaction.
          </p>
        </div>
      </div>

      <div className="pp-selected-loan">
        <div className="pp-loan-heading">
          <h3>Selected Pawn Loan</h3>

          <span className="pp-active-badge">
            Active
          </span>
        </div>

        <div className="pp-grid">
          <div className="pp-info">
            <span>Loan Number</span>
            <strong>{loan.loanNumber || "-"}</strong>
          </div>

          <div className="pp-info">
            <span>Customer Name</span>
            <strong>
              {loan.customer?.fullName || "-"}
            </strong>
          </div>

          <div className="pp-info">
            <span>Customer Code</span>
            <strong>
              {loan.customer?.customerCode || "-"}
            </strong>
          </div>

          <div className="pp-info">
            <span>Original Principal</span>
            <strong>
              {formatAmount(loan.principalAmount)}
            </strong>
          </div>
        </div>
      </div>

      <form
        className="pp-form"
        onSubmit={handleCalculate}
      >
        <h3>
          <Wallet size={18} />
          Payment Information
        </h3>

        <div className="pp-form-grid">
          <div className="pp-field">
            <label htmlFor="ppAmount">
              Payment Amount (LKR)
            </label>

            <input
              id="ppAmount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              maxLength={20}
              onChange={(event) => {
                invalidatePreview();
                setAmount(event.target.value);
              }}
              required
            />
          </div>

          <div className="pp-field">
            <label htmlFor="ppMethod">
              Payment Method
            </label>

            <select
              id="ppMethod"
              value={paymentMethod}
              onChange={(event) => {
                invalidatePreview();
                setPaymentMethod(event.target.value);
              }}
            >
              <option value="cash">Cash</option>

              <option value="bank_transfer">
                Bank Transfer
              </option>
            </select>
          </div>

          <div className="pp-field">
            <label htmlFor="ppReference">
              Payment Reference (Optional)
            </label>

            <input
              id="ppReference"
              type="text"
              placeholder="Enter reference"
              value={reference}
              maxLength={150}
              onChange={(event) => {
                invalidatePreview();
                setReference(event.target.value);
              }}
            />
          </div>
        </div>

        <p className="pp-help">
          Payment method and reference are for
          preparation only. They are not saved.
        </p>

        <div className="pp-actions">
          <button
            type="submit"
            className="pp-primary"
            disabled={loading}
          >
            <Calculator size={16} />

            {loading
              ? "Calculating..."
              : "Calculate Payment"}
          </button>

          <button
            type="button"
            className="pp-secondary"
            onClick={handleReset}
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="pp-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {preview && balance && allocation && rules && (
        <div className="pp-results">
          <div className="pp-section-heading">
            <h3>Outstanding Balance</h3>

            <span>
              Calculated:{" "}
              {formatDate(preview.calculationDate)}
            </span>
          </div>

          <div className="pp-grid">
            <div className="pp-info">
              <span>Outstanding Principal</span>
              <strong>
                {formatAmount(
                  balance.outstandingPrincipal
                )}
              </strong>
            </div>

            <div className="pp-info">
              <span>Outstanding Interest</span>
              <strong>
                {formatAmount(
                  balance.outstandingInterest
                )}
              </strong>
            </div>

            <div className="pp-info">
              <span>Total Principal Paid</span>
              <strong>
                {formatAmount(
                  balance.totalPrincipalPaid
                )}
              </strong>
            </div>

            <div className="pp-info">
              <span>Total Interest Paid</span>
              <strong>
                {formatAmount(
                  balance.totalInterestPaid
                )}
              </strong>
            </div>
          </div>

          <div className="pp-total">
            <span>Combined Outstanding Balance</span>

            <strong>
              {formatAmount(balance.combinedBalance)}
            </strong>
          </div>

          <div className="pp-rules">
            <h3>Loan Payment Rules</h3>

            <div className="pp-rule-row">
              <span>Partial Payments</span>
              <strong>
                {rules.enabled
                  ? "Allowed"
                  : "Not Allowed"}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Partial Interest Payments</span>
              <strong>
                {rules.allowPartialInterest
                  ? "Allowed"
                  : "Not Allowed"}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Partial Principal Payments</span>
              <strong>
                {rules.allowPartialPrincipal
                  ? "Allowed"
                  : "Not Allowed"}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Allocation Method</span>

              <strong>
                {rules.allocationMethod ===
                "interest_first"
                  ? "Interest First"
                  : rules.allocationMethod ===
                      "principal_first"
                    ? "Principal First"
                    : "Unsupported"}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Minimum Payment</span>

              <strong>
                {formatAmount(rules.minimumAmount)}
              </strong>
            </div>
          </div>

          <div className="pp-allocation">
            <h3>Payment Allocation Preview</h3>

            <div className="pp-rule-row">
              <span>Payment Amount</span>

              <strong>
                {formatAmount(preview.paymentAmount)}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Interest Allocation</span>

              <strong>
                {formatAmount(allocation.interestPaid)}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Principal Allocation</span>

              <strong>
                {formatAmount(allocation.principalPaid)}
              </strong>
            </div>

            <hr />

            <div className="pp-rule-row">
              <span>Remaining Principal</span>

              <strong>
                {formatAmount(
                  allocation.remainingPrincipal
                )}
              </strong>
            </div>

            <div className="pp-rule-row">
              <span>Remaining Interest</span>

              <strong>
                {formatAmount(
                  allocation.remainingInterest
                )}
              </strong>
            </div>

            <div className="pp-total">
              <span>Remaining Combined Balance</span>

              <strong>
                {formatAmount(
                  allocation.remainingCombinedBalance
                )}
              </strong>
            </div>
          </div>

          <div className="pp-warning">
            <AlertCircle size={20} />

            <div>
              <strong>Calculation Preview Only</strong>

              <p>
                Overdue penalties are not included.
                This is not a final settlement amount.
                Balances may change after calculation.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="pp-disabled-section">
        <button type="button" disabled>
          <Lock size={17} />
          Record Payment
        </button>

        <p>
          Payment posting is currently disabled.
          No financial transaction will be recorded.
        </p>
      </div>
    </section>
  );
}