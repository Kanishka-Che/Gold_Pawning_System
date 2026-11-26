
import { useState } from "react";
import {
  Settings,
  Store,
  Calculator,
  ReceiptText,
  Printer,
} from "lucide-react";

import LoanSettings from "./LoanSettings.jsx";
import ShopSettings from "./ShopSettings.jsx";
import PawnTicketSettings from "./PawnTicketSettings.jsx";
import PrintingSettings from "./PrintingSettings.jsx";
import "./SystemSettings.scss";

const settingsTabs = [
  {
    id: "shop",
    label: "Shop Settings",
    icon: Store,
  },
  {
    id: "loan",
    label: "Loan & Interest",
    icon: Calculator,
  },
  {
    id: "ticket",
    label: "Pawn Ticket",
    icon: ReceiptText,
  },
  {
    id: "printing",
    label: "Printing Settings",
    icon: Printer,
  },
];

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState("shop");

  return (
    <div className="system-settings-page">
      <div className="system-settings-header">
        <div className="system-settings-header-icon">
          <Settings size={28} />
        </div>

        <div>
          <h1>System Settings</h1>
          <p>
            Manage your gold pawning business settings.
          </p>
        </div>
      </div>

      <div className="system-settings-tabs">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={`system-settings-tab ${
                activeTab === tab.id ? "active" : ""
              }`}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="system-settings-content">
        {activeTab === "shop" && <ShopSettings />}

        {activeTab === "loan" && <LoanSettings />}

        {activeTab === "ticket" && <PawnTicketSettings />}

        {activeTab === "printing" && <PrintingSettings />}
      </div>
    </div>
  );
}
