
import { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api.js";

const getForm = (settings) => ({
  gracePeriodDays: String(
    settings?.overdue?.gracePeriodDays ?? 0
  ),

  penaltyEnabled:
    settings?.overdue?.penaltyEnabled ?? false,

  penaltyRate: String(
    settings?.overdue?.penaltyRate ?? 0
  ),
});

export default function OverdueSettings({
  settings,
  editing,
  onEditingChange,
  disabled,
  onSettingsUpdated,
}) {
  const [form, setForm] = useState(
    () => getForm(settings)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!editing) {
      setForm(getForm(settings));
    }
  }, [settings, editing]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleEdit = () => {
    if (disabled || saving || conflict) return;

    setForm(getForm(settings));
    setError("");
    setSuccess("");
    onEditingChange(true);
  };

  const handleCancel = () => {
    if (saving) return;

    setForm(getForm(settings));
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

    const gracePeriodDays = Number(
      form.gracePeriodDays
    );

    const penaltyRate = Number(
      form.penaltyRate
    );

    if (
      form.gracePeriodDays.trim() === "" ||
      !Number.isSafeInteger(gracePeriodDays) ||
      gracePeriodDays < 0
    ) {
      setError(
        "Grace period must be a non-negative integer."
      );
      return;
    }

    if (
      form.penaltyRate.trim() === "" ||
      !Number.isFinite(penaltyRate) ||
      penaltyRate < 0
    ) {
      setError(
        "Enter a valid non-negative penalty rate."
      );
      return;
    }

    const overdue = {
      gracePeriodDays,
      penaltyEnabled: form.penaltyEnabled,
      penaltyRate,
    };

    const current = settings.overdue ?? {};

    const hasChanges = Object.entries(
      overdue
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: settings.version,
            overdue,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 409) {
        setConflict(true);

        throw new Error(
          "Settings were changed by another Admin. " +
          "Reload the page before saving."
        );
      }

      if (
        !response.ok ||
        !data.success ||
        !data.settings
      ) {
        throw new Error(
          data.message ||
          "Failed to save overdue settings."
        );
      }

      onSettingsUpdated(data.settings);
      setForm(getForm(data.settings));
      onEditingChange(false);

      setSuccess(
        "Overdue settings saved successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldsDisabled =
    !editing || saving || conflict || disabled;

  return (
    <div className="loan-settings-card">
      <div className="loan-settings-section-header">
        <h2>Overdue Settings</h2>

        <span>
          Version {settings?.version ?? "-"}
        </span>
      </div>

      <div className="loan-settings-field">
        <label htmlFor="overdueGracePeriod">
          Grace Period (Days)
        </label>

        <input
          id="overdueGracePeriod"
          type="number"
          min="0"
          step="1"
          value={form.gracePeriodDays}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "gracePeriodDays",
              e.target.value
            )
          }
        />
      </div>

      <div className="loan-settings-field">
        <label htmlFor="overduePenaltyEnabled">
          Enable Overdue Penalty
        </label>

        <select
          id="overduePenaltyEnabled"
          value={String(form.penaltyEnabled)}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "penaltyEnabled",
              e.target.value === "true"
            )
          }
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>

      <div className="loan-settings-field">
        <label htmlFor="overduePenaltyRate">
          Configured Penalty Rate (%)
        </label>

        <input
          id="overduePenaltyRate"
          type="number"
          min="0"
          step="any"
          value={form.penaltyRate}
          disabled={fieldsDisabled}
          onChange={(e) =>
            updateField(
              "penaltyRate",
              e.target.value
            )
          }
        />
      </div>

      <div className="loan-settings-actions">
        {!editing ? (
          <button
            type="button"
            disabled={
              disabled || saving || conflict
            }
            onClick={handleEdit}
          >
            Edit Settings
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                saving || conflict || disabled
              }
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
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

      <div className="loan-settings-warning">
        Grace period settings are used for loan
        overdue classification.

        Penalty settings are configuration only.
        Calculation methods, calculation bases,
        and collection rules must be confirmed
        before financial transactions are enabled.
      </div>

      <div className="loan-settings-warning">
        Changes apply to newly created pawn loans.
        Existing loans retain their original
        settings snapshots.
      </div>
    </div>
  );
}
