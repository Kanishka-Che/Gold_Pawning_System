import { useState } from "react";

import {
  CalendarClock,
  ShieldCheck,
  Search,
} from "lucide-react";

import PaymentLoanSearch from "../Payments/PaymentLoanSearch.jsx";
import RenewalRecords from "./RenewalRecords.jsx";
import RenewalPreview from "./RenewalPreview.jsx";

import "./Renewals.scss";

export default function Renewals() {
  const [selectedLoan, setSelectedLoan] =
    useState(null);

  return (
    <section className="renewals-page">
      <div className="rn-page-header">
        <div className="rn-page-heading">
          <div className="rn-header-icon">
            <CalendarClock size={28} />
          </div>

          <div>
            <h1>Loan Renewals</h1>

            <p>
              Review pawn loan renewals and
              maturity extensions.
            </p>
          </div>
        </div>

        <span className="rn-preview-badge">
          Preview Mode
        </span>
      </div>

      <div className="rn-readonly-notice">
        <ShieldCheck size={23} />

        <div>
          <strong>Read-only Renewal Module</strong>

          <p>
            Search active pawn loans and review
            renewal calculations. Actual renewal
            transactions are currently disabled.
          </p>
        </div>
      </div>

      <PaymentLoanSearch
        onLoanSelected={setSelectedLoan}
      />

      {selectedLoan ? (
        <RenewalPreview
          key={selectedLoan._id}
          loan={selectedLoan}
        />
      ) : (
        <div className="rn-card rn-empty">
          <Search size={38} />

          <h3>Select a Pawn Loan</h3>

          <p>
            Search and select an active pawn loan
            to review its renewal information.
                    </p>
        </div>
      )}

      <RenewalRecords />

    </section>
  );
}