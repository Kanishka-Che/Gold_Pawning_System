import { useEffect, useState } from "react";

import { apiFetch } from "../../../utils/api.js";

const getRedemptionForm = (settings) => ({
  enabled:
    settings?.redemption?.enabled ?? false,

  allowEarlyRedemption:
    settings?.redemption?.allowEarlyRedemption ?? false,

  allowOverdueRedemption:
    settings?.redemption?.allowOverdueRedemption ?? false,

  includeOverduePenalties:
    settings?.redemption?.includeOverduePenalties ?? false,

  requireCustomerVerification:
    settings?.redemption?.requireCustomerVerification ?? true,

  requireAdminApproval:
    settings?.redemption?.requireAdminApproval ?? true,
});

const fields = [
  {
    name: "enabled",
    label: "Enable Redemption",
  },
  {
    name: "allowEarlyRedemption",
    label: "Allow Early Redemption",
  },
  {
    name: "allowOverdueRedemption",
    label: "Allow Overdue Redemption",
  },
  {
    name: "includeOverduePenalties",
    label: "Include Overdue Penalties",
  },
  {
    name: "requireCustomerVerification",
    label: "Require Customer Verification",
  },
  {
    name: "requireAdminApproval",
    label: "Require Admin Approval",
  },
];

export default function RedemptionSettings({
  settings,
  editing,
  onEditingChange,
  disabled,
  onSettingsUpdated,
}) {
  const [form, setForm] = useState(
    getRedemptionForm(settings)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!editing) {
      setForm(getRedemptionForm(settings));
    }
  }, [settings, editing]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleEdit = () => {
    setError("");
    setSuccess("");
    setForm(getRedemptionForm(settings));
    onEditingChange(true);
  };

  const handleCancel = () => {
    if (saving) return;

    setForm(getRedemptionForm(settings));
    setError("");
    setSuccess("");
    onEditingChange(false);
  };

  const handleSave = async () => {
    if (
      saving ||
      !editing ||
      disabled ||
      conflict ||
      !settings
    ) {
      return;
    }

    setError("");
    setSuccess("");

    const hasChanges = Object.entries(form).some(
      ([key, value]) =>
        settings.redemption?.[key] !== value
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
            redemption: form,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 409) {
        setConflict(true);

        throw new Error(
          "Settings have changed. Reload the page before saving."
        );
      }

      if (
        !response.ok ||
        !data.success ||
        !data.settings
      ) {
        throw new Error(
          data.message ||
            "Failed to save redemption settings."
        );
      }

      onSettingsUpdated(data.settings);

      setForm(
        getRedemptionForm(data.settings)
      );

      onEditingChange(false);

      setSuccess(
        "Redemption settings saved successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="loan-settings-card">
      <div className="loan-settings-section-header">
        <h2>Redemption Settings</h2>

        <span>
          Version {settings?.version ?? "-"}
        </span>
      </div>

      {fields.map((field) => (
        <div
          className="loan-settings-field"
          key={field.name}
        >
          <label htmlFor={`redemption-${field.name}`}>
            {field.label}
          </label>

          <select
            id={`redemption-${field.name}`}
            value={String(form[field.name])}
            disabled={
              !editing ||
              saving ||
              disabled ||
              conflict
            }
            onChange={(event) =>
              updateField(
                field.name,
                event.target.value === "true"
              )
            }
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      ))}

      <div className="loan-settings-field">
        <label htmlFor="redemption-release-method">
          Gold Release Method
        </label>

        <input
          id="redemption-release-method"
          value="All pledged gold items"
          disabled
          readOnly
        />
      </div>

      <div className="loan-settings-warning">
        These settings are saved as proposed business
        rules. Actual redemption transactions, penalty
        settlement and gold release remain disabled
        until the financial workflow is confirmed.
      </div>

      <div className="loan-settings-actions">
        {!editing ? (
          <button
            type="button"
            disabled={
              disabled ||
              saving ||
              conflict ||
              !settings
            }
            onClick={handleEdit}
          >
            Edit Settings
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={
                saving ||
                disabled ||
                conflict
              }
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleCancel}
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
    </div>
  );
}