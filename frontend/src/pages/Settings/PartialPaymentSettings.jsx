
import { useState } from "react";
import { apiFetch } from "../../../utils/api.js";

const getPartialPaymentForm = (settings) => ({
  enabled: settings?.partialPayment?.enabled ?? false,

  allowPartialInterest:
    settings?.partialPayment?.allowPartialInterest ?? false,

  allowPartialPrincipal:
    settings?.partialPayment?.allowPartialPrincipal ?? false,

  allocationMethod:
    settings?.partialPayment?.allocationMethod ?? "interest_first",

  minimumAmount: String(
    settings?.partialPayment?.minimumAmount ?? 0
  ),
});

export default function PartialPaymentSettings({
  settings,
  onSettingsUpdated,
  editing,
  onEditingChange,
  disabled = false,
}) {
  const [form, setForm] = useState(() =>
    getPartialPaymentForm(settings)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);

  const currentForm = editing
    ? form
    : getPartialPaymentForm(settings);

  const locked = !editing || saving || conflict || disabled;

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleEdit = () => {
    setForm(getPartialPaymentForm(settings));
    setError("");
    setSuccess("");
    onEditingChange(true);
  };

  const handleCancel = () => {
    setForm(getPartialPaymentForm(settings));
    setError("");
    setSuccess("");
    onEditingChange(false);
  };

  const handleSave = async () => {
    if (
      saving ||
      !editing ||
      !settings ||
      conflict ||
      disabled
    ) {
      return;
    }

    setError("");
    setSuccess("");

    const amountText = form.minimumAmount.trim();
    const minimumAmount = Number(amountText);

    if (
      !/^\d+(\.\d{1,2})?$/.test(amountText) ||
      !Number.isFinite(minimumAmount) ||
      minimumAmount < 0 ||
      !Number.isSafeInteger(
        Math.round(minimumAmount * 100)
      )
    ) {
      setError(
        "Enter a valid minimum payment amount with up to two decimal places."
      );
      return;
    }

    if (
      !["interest_first", "principal_first"].includes(
        form.allocationMethod
      )
    ) {
      setError("Select a valid payment allocation method.");
      return;
    }

    const partialPayment = {
      enabled: form.enabled,
      allowPartialInterest: form.allowPartialInterest,
      allowPartialPrincipal: form.allowPartialPrincipal,
      allocationMethod: form.allocationMethod,
      minimumAmount,
    };

    const current = settings.partialPayment ?? {};

    const hasChanges = Object.entries(partialPayment).some(
      ([key, value]) => current[key] !== value
    );

    if (!hasChanges) {
      onEditingChange(false);
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
            partialPayment,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (response.status === 409) {
        setConflict(true);

        throw new Error(
          "Settings were changed by another Admin. Reload the page before saving."
        );
      }

      if (!response.ok || !data?.success || !data.settings) {
        throw new Error(
          data?.message || "Failed to save partial payment settings."
        );
      }

      onSettingsUpdated(data.settings);
      setForm(getPartialPaymentForm(data.settings));
      onEditingChange(false);

      setSuccess(
        "Partial payment settings saved successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="loan-settings-card partial-payment-settings">

      <div className="loan-settings-section-header">
        <h2>Partial Payment Settings</h2>
        <span>Version {settings.version}</span>
      </div>

      <p className="partial-settings-description">
        Configure pawn loan repayment rules.
      </p>

      <div className="partial-settings-options">

        <label className="partial-settings-option">
          <div>
            <strong>Enable Partial Payments</strong>
            <small>
              Allow customers to make partial loan repayments.
            </small>
          </div>

          <input
            type="checkbox"
            checked={currentForm.enabled}
            disabled={locked}
            onChange={(e) =>
              updateField("enabled", e.target.checked)
            }
          />
        </label>

        <label className="partial-settings-option">
          <div>
            <strong>Allow Partial Interest Payments</strong>
            <small>
              Allow paying only part of the outstanding interest.
            </small>
          </div>

          <input
            type="checkbox"
            checked={currentForm.allowPartialInterest}
            disabled={locked || !currentForm.enabled}
            onChange={(e) =>
              updateField(
                "allowPartialInterest",
                e.target.checked
              )
            }
          />
        </label>

        <label className="partial-settings-option">
          <div>
            <strong>Allow Partial Principal Payments</strong>
            <small>
              Allow paying only part of the outstanding principal.
            </small>
          </div>

          <input
            type="checkbox"
            checked={currentForm.allowPartialPrincipal}
            disabled={locked || !currentForm.enabled}
            onChange={(e) =>
              updateField(
                "allowPartialPrincipal",
                e.target.checked
              )
            }
          />
        </label>

      </div>

      <div className="partial-settings-fields">

        <div className="loan-settings-field">
          <label htmlFor="paymentAllocationMethod">
            Payment Allocation Method
          </label>

          <select
            id="paymentAllocationMethod"
            value={currentForm.allocationMethod}
            disabled={locked || !currentForm.enabled}
            onChange={(e) =>
              updateField("allocationMethod", e.target.value)
            }
          >
            <option value="interest_first">
              Interest First
            </option>

            <option value="principal_first">
              Principal First
            </option>
          </select>

          <small>
            Determines how a payment is allocated between
            interest and principal.
          </small>
        </div>

        <div className="loan-settings-field">
          <label htmlFor="minimumPaymentAmount">
            Minimum Payment Amount (LKR)
          </label>

          <input
            id="minimumPaymentAmount"
            type="number"
            min="0"
            step="0.01"
            value={currentForm.minimumAmount}
            disabled={locked || !currentForm.enabled}
            onChange={(e) =>
              updateField("minimumAmount", e.target.value)
            }
          />

          <small>
            Minimum amount accepted for a partial payment.
          </small>
        </div>

      </div>

      <div className="loan-settings-actions">
        {!editing ? (
          <button
            type="button"
            onClick={handleEdit}
            disabled={disabled || conflict}
          >
            Edit Settings
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || conflict || disabled}
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
        <div
          className="loan-settings-warning"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <p
          className="loan-settings-success"
          role="status"
        >
          {success}
        </p>
      )}

      {conflict && (
        <button
          type="button"
          className="partial-settings-reload"
          onClick={() => window.location.reload()}
        >
          Reload Settings
        </button>
      )}

      <div className="loan-settings-warning">
        Changes apply to newly created pawn loans.
        Existing loans retain their original settings snapshot.
        Payment posting remains disabled.
      </div>

    </div>
  );
}
