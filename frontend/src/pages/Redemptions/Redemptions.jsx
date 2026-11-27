import { useState } from "react";

import {
  Gem,
  ShieldCheck,
  Search,
} from "lucide-react";

import PaymentLoanSearch from
  "../Payments/PaymentLoanSearch.jsx";

  import RedemptionRecords from
  "./RedemptionRecords.jsx";

import RedemptionPreview from
  "./RedemptionPreview.jsx";

import "./Redemptions.scss";

export default function Redemptions() {
  const [selectedLoan, setSelectedLoan] =
    useState(null);

  return (
    <section className="redemptions-page">
      <div className="rd-page-header">
        <div className="rd-page-heading">
          <div className="rd-header-icon">
            <Gem size={28} />
          </div>

          <div>
            <h1>Gold Redemptions</h1>

            <p>
              Review pawn loan settlements
              and gold releases.
            </p>
          </div>
        </div>

        <span className="rd-preview-badge">
          Preview Mode
        </span>
      </div>

      <div className="rd-readonly-notice">
        <ShieldCheck size={23} />

        <div>
          <strong>
            Read-only Redemption Module
          </strong>

          <p>
            Search active pawn loans and review
            estimated settlement amounts.
            Actual redemption transactions
            and gold releases are currently
            disabled.
          </p>
        </div>
      </div>

      <PaymentLoanSearch
        onLoanSelected={setSelectedLoan}
      />

      {selectedLoan ? (
        <RedemptionPreview
          key={selectedLoan._id}
          loan={selectedLoan}
        />
      ) : (
        <div className="rd-card rd-empty">
          <Search size={38} />

          <h3>Select a Pawn Loan</h3>

          <p>
            Search and select an active pawn
            loan to review its redemption
            information.
          </p>
        </div>
      )}
      <RedemptionRecords />
    </section>
  );
}