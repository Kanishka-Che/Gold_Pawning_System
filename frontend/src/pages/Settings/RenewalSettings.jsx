import { useState } from "react";
import { apiFetch } from "../../../utils/api.js";

const getRenewalForm = (settings) => ({
  enabled: settings?.renewal?.enabled ?? false,

  durationMonths: String(
    settings?.renewal?.durationMonths ?? 6
  ),

  requireInterestSettlement:
    settings?.renewal?.requireInterestSettlement ?? true,

  renewalFee: String(
    settings?.renewal?.renewalFee ?? 0
  ),
});

export default function RenewalSettings({
  settings,
  editing,
  onEditingChange,
  disabled,
  onSettingsUpdated,
}) {
  const [form, setForm] = useState(
    () => getRenewalForm(settings)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);

  const displayedForm = editing
    ? form
    : getRenewalForm(settings);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleEdit = () => {
    setForm(getRenewalForm(settings));
    setError("");
    setSuccess("");
    onEditingChange(true);
  };

  const handleCancel = () => {
    setForm(getRenewalForm(settings));
    setError("");
    setSuccess("");
    onEditingChange(false);
  };

  const handleSave = async () => {
    if (
      saving ||
      disabled ||
      conflict ||
      !editing ||
      !settings
    ) {
      return;
    }

    setError("");
    setSuccess("");

    const durationMonths = Number(
      form.durationMonths
    );

    const renewalFee = Number(form.renewalFee);

    if (
      !/^[1-9]\d*$/.test(
        form.durationMonths.trim()
      ) ||
      !Number.isSafeInteger(durationMonths) ||
      durationMonths < 1 ||
      durationMonths > 120
    ) {
      setError(
        "Renewal duration must be between 1 and 120 months."
      );
      return;
    }

    if (
      !/^\d+(\.\d{1,2})?$/.test(
        form.renewalFee.trim()
      ) ||
      !Number.isFinite(renewalFee) ||
      renewalFee < 0 ||
      !Number.isSafeInteger(
        Math.round(renewalFee * 100)
      )
    ) {
      setError(
        "Enter a valid renewal fee with at most two decimal places."
      );
      return;
    }

    const renewal = {
      enabled: form.enabled,
      durationMonths,
      requireInterestSettlement:
        form.requireInterestSettlement,
      renewalFee,
    };

    const current = settings.renewal ?? {};

    const hasChanges = Object.entries(
      renewal
    ).some(
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
          body: JSON.stringify({
            expectedVersion: settings.version,
            renewal,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (response.status === 409) {
        setConflict(true);

        throw new Error(
          "Settings were changed by another Admin. Reload the page before editing again."
        );
      }

      if (
        !response.ok ||
        !data?.success ||
        !data.settings
      ) {
        throw new Error(
          data?.message ||
            "Failed to save renewal settings."
        );
      }

      onSettingsUpdated(data.settings);

      setForm(
        getRenewalForm(data.settings)
      );

      onEditingChange(false);

      setSuccess(
        "Renewal settings saved successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldsDisabled =
    !editing || saving || disabled || conflict;

  return (
    <div className="loan-settings-card">
      <div className="loan-settings-section-header">
        <h2>Renewal Settings</h2>
        <span>Version {settings.version}</span>
      </div>

      <div className="loan-settings-field">
        <label htmlFor="renewalEnabled">
          Enable Loan Renewal
        </label>

        <select
          id="renewalEnabled"
          value={String(displayedForm.enabled)}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "enabled",
              e.target.value === "true"
            )
          }
        >
          <option value="false">Disabled</option>
          <option value="true">Enabled</option>
        </select>
      </div>

      <div className="loan-settings-field">
        <label htmlFor="renewalDuration">
          Renewal Duration (Months)
        </label>

        <input
          id="renewalDuration"
          type="number"
          min="1"
          max="120"
          step="1"
          value={displayedForm.durationMonths}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "durationMonths",
              e.target.value
            )
          }
        />
      </div>

      <div className="loan-settings-field">
        <label htmlFor="renewalInterest">
          Require Full Interest Settlement
        </label>

        <select
          id="renewalInterest"
          value={String(
            displayedForm.requireInterestSettlement
          )}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "requireInterestSettlement",
              e.target.value === "true"
            )
          }
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      <div className="loan-settings-field">
        <label htmlFor="renewalFee">
          Renewal Fee (LKR)
        </label>

        <input
          id="renewalFee"
          type="number"
          min="0"
          step="0.01"
          value={displayedForm.renewalFee}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "renewalFee",
              e.target.value
            )
          }
        />
      </div>

      <div className="loan-settings-actions">
        {!editing ? (
          <button
            type="button"
            disabled={disabled || conflict}
            onClick={handleEdit}
          >
            Edit Settings
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={
                saving || disabled || conflict
              }
              onClick={handleSave}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
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

        {conflict && (
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload Settings
          </button>
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

      <div className="loan-settings-warning">
        Renewal settings are saved for future loan
        configurations. Existing loan settings
        snapshots are not automatically changed.
        Actual renewal posting remains disabled.
      </div>
    </div>
  );
}