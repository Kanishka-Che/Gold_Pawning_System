import { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api.js";
import PartialPaymentSettings from "./PartialPaymentSettings.jsx";
import RenewalSettings from "./RenewalSettings.jsx";
import RedemptionSettings from "./RedemptionSettings.jsx";
import OverdueSettings from "./OverdueSettings.jsx";
import "./LoanSettings.scss";

const getInterestForm = (settings) => ({
  rate: String(settings?.interest?.rate ?? 0),
  calculationMethod:
    settings?.interest?.calculationMethod ?? "monthly",
  principalCalculationMethod:
    settings?.interest?.principalCalculationMethod ?? "",
  minimumInterestDays: String(
    settings?.interest?.minimumInterestDays ?? 0
  ),
  chargeFullFirstMonth:
    settings?.interest?.chargeFullFirstMonth ?? false,
});

export default function LoanSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
const [success, setSuccess] = useState("");
const [partialEditing, setPartialEditing] = useState(false);
const [renewalEditing, setRenewalEditing] =
  useState(false);
  const [redemptionEditing, setRedemptionEditing] =
  useState(false);
  const [overdueEditing, setOverdueEditing] =
  useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await apiFetch("/api/loan-settings");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load loan settings"
          );
        }

        if (!cancelled) {
          setSettings(data.settings ?? null);
          setForm(getInterestForm(data.settings));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleCancel = () => {
    setForm(getInterestForm(settings));
    setEditing(false);
  };


const handleSave = async () => {
  if (saving || !settings || !form) return;

  setError("");
  setSuccess("");

  const rate = Number(form.rate);
  const minimumInterestDays = Number(
    form.minimumInterestDays
  );

  if (
    form.rate.trim() === "" ||
    !Number.isFinite(rate) ||
    rate < 0
  ) {
    setError("Enter a valid interest rate.");
    return;
  }

  if (
    form.minimumInterestDays.trim() === "" ||
    !Number.isSafeInteger(minimumInterestDays) ||
    minimumInterestDays < 0
  ) {
    setError("Minimum interest days must be a non-negative integer.");
    return;
  }

  if (!form.principalCalculationMethod) {
    setError("Select a principal calculation method.");
    return;
  }

  // Temporarily block rules not yet supported by
  // the complete financial calculation workflow.
  if (
    form.principalCalculationMethod !== "original_principal" ||
    minimumInterestDays !== 0 ||
    form.chargeFullFirstMonth !== false
  ) {
    setError(
      "This financial rule combination is not yet supported. " +
      "Use Original Principal, 0 minimum days, and No full first month."
    );
    return;
  }

  const interest = {
    rate,
    calculationMethod: form.calculationMethod,
    principalCalculationMethod:
      form.principalCalculationMethod,
    minimumInterestDays,
    chargeFullFirstMonth:
      form.chargeFullFirstMonth,
  };

  // Avoid creating unnecessary settings versions.
  const current = settings.interest ?? {};

  const hasChanges = Object.entries(interest).some(
    ([key, value]) => current[key] !== value
  );

  if (!hasChanges) {
    setEditing(false);
    setSuccess("No changes to save.");
    return;
  }

  setSaving(true);

  try {
    const response = await apiFetch(
      "/api/loan-settings",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: settings.version,
          interest,
        }),
      }
    );

    const data = await response.json();

    if (response.status === 409) {
      throw new Error(
        "Settings were changed by another Admin. Reload the page before saving."
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to save loan settings."
      );
    }

    setSettings(data.settings);
    setForm(getInterestForm(data.settings));
    setEditing(false);
    setSuccess("Loan settings saved successfully.");
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};


  if (loading) {
    return (
      <div className="loan-settings-page">
        <p>Loading loan settings...</p>
      </div>
    );
  }

  if (!settings || !form) {
  return (
    <div className="loan-settings-page">
      <div className="loan-settings-warning">
        {error || "Loan settings have not been configured."}
      </div>
    </div>
  );
}

  return (
    <div className="loan-settings-page">
      <div className="loan-settings-header">
        <h1>Loan Settings</h1>
        <p>Manage pawn loan business rules.</p>
      </div>

      <div className="loan-settings-card">
        <div className="loan-settings-section-header">
          <h2>Interest Settings</h2>
          <span>Version {settings.version}</span>
        </div>

        <div className="loan-settings-field">
          <label htmlFor="interestRate">
            Monthly Interest Rate (%)
          </label>
          <input
            id="interestRate"
            type="number"
            min="0"
            step="0.01"
            value={form.rate}
            disabled={!editing}
            onChange={(e) =>
              updateField("rate", e.target.value)
            }
          />
        </div>

        <div className="loan-settings-field">
          <label htmlFor="calculationMethod">
            Calculation Method
          </label>
          <select
            id="calculationMethod"
            value={form.calculationMethod}
            disabled={!editing}
            onChange={(e) =>
              updateField("calculationMethod", e.target.value)
            }
          >
            <option value="monthly">Monthly</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        <div className="loan-settings-field">
          <label htmlFor="principalMethod">
            Principal Calculation Method
          </label>
          <select
            id="principalMethod"
            value={form.principalCalculationMethod}
            disabled={!editing}
            onChange={(e) =>
              updateField(
                "principalCalculationMethod",
                e.target.value
              )
            }
          >
            <option value="">Not Confirmed</option>
            <option value="original_principal">
              Original Principal
            </option>
            <option value="remaining_principal">
              Remaining Principal
            </option>
          </select>
        </div>

        <div className="loan-settings-field">
          <label htmlFor="minimumInterestDays">
            Minimum Interest Days
          </label>
          <input
            id="minimumInterestDays"
            type="number"
            min="0"
            step="1"
            value={form.minimumInterestDays}
            disabled={!editing}
            onChange={(e) =>
              updateField(
                "minimumInterestDays",
                e.target.value
              )
            }
          />
        </div>

        <div className="loan-settings-field">
          <label htmlFor="chargeFullFirstMonth">
            Charge Full First Month
          </label>
          <select
            id="chargeFullFirstMonth"
            value={String(form.chargeFullFirstMonth)}
            disabled={!editing}
            onChange={(e) =>
              updateField(
                "chargeFullFirstMonth",
                e.target.value === "true"
              )
            }
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>

        <div className="loan-settings-actions">
          {!editing ? (
           <button
  type="button"
 disabled={
  partialEditing ||
  renewalEditing ||
  redemptionEditing ||
  overdueEditing ||
  saving
}
  onClick={() => {
    setError("");
    setSuccess("");
    setEditing(true);
  }}
>
  Edit Settings
</button>
          ) : (
            <>
              <button
  type="button"
  onClick={handleSave}
  disabled={saving}
>
  {saving ? "Saving..." : "Save Changes"}
</button>

              <button
  type="button"
  onClick={handleCancel}
  disabled={saving}
>
  Cancel
</button>
            </>
          )}
        </div>

       {error && (
  <div className="loan-settings-warning" role="alert">
    {error}
  </div>
)}

{success && (
  <p role="status" className="loan-settings-success">
    {success}
  </p>
)}

        <div className="loan-settings-warning">
          Only Original Principal with 0 minimum interest days
          and no full first-month charge is currently enabled
          for saving. Other financial rules require further
          calculation support.
        </div>

      </div>

     <PartialPaymentSettings
  settings={settings}
  editing={partialEditing}
  onEditingChange={setPartialEditing}
  disabled={
  editing ||
  renewalEditing ||
  redemptionEditing ||
  overdueEditing ||
  saving
}
  onSettingsUpdated={(updatedSettings) => {
    setSettings(updatedSettings);
    setForm(getInterestForm(updatedSettings));
  }}
/>

<RenewalSettings
  settings={settings}
  editing={renewalEditing}
  onEditingChange={setRenewalEditing}
  disabled={
  editing ||
  partialEditing ||
  redemptionEditing ||
  overdueEditing ||
  saving
}
  onSettingsUpdated={(updatedSettings) => {
    setSettings(updatedSettings);
    setForm(getInterestForm(updatedSettings));
  }}
/>

<RedemptionSettings
  settings={settings}
  editing={redemptionEditing}
  onEditingChange={setRedemptionEditing}
  disabled={
  editing ||
  partialEditing ||
  renewalEditing ||
  overdueEditing ||
  saving
}
  onSettingsUpdated={(updatedSettings) => {
    setSettings(updatedSettings);
    setForm(getInterestForm(updatedSettings));
  }}
/>

<OverdueSettings
  settings={settings}
  editing={overdueEditing}
  onEditingChange={setOverdueEditing}
  disabled={
    editing ||
    partialEditing ||
    renewalEditing ||
    redemptionEditing ||
    saving
  }
  onSettingsUpdated={(updatedSettings) => {
    setSettings(updatedSettings);
    setForm(getInterestForm(updatedSettings));
  }}
/>

    </div>
  );
}
