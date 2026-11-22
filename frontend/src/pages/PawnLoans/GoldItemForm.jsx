
import { useState } from "react";
import { apiFetch } from "../../../utils/api";
import "./GoldItemForm.scss";

const initialForm = {
  itemType: "",
  description: "",
  karat: "22K",
  grossWeight: "",
  deductionWeight: "0",
};

export default function GoldItemForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const gross = Number(form.grossWeight);
  const deduction = Number(form.deductionWeight);

  const netWeight =
    form.grossWeight !== "" &&
    form.deductionWeight !== "" &&
    Number.isFinite(gross) &&
    Number.isFinite(deduction) &&
    gross > 0 &&
    deduction >= 0 &&
    deduction < gross
      ? Math.round((gross - deduction) * 1000) / 1000
      : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.itemType.trim()) {
      setError("Item Type is required.");
      return;
    }

    if (form.itemType.trim().length > 100) {
      setError("Item Type must be 100 characters or less.");
      return;
    }

    if (form.description.trim().length > 500) {
      setError("Description must be 500 characters or less.");
      return;
    }

    if (netWeight === null) {
      setError("Please enter valid gold weights.");
      return;
    }

    const payload = {
      itemType: form.itemType.trim(),
      description: form.description.trim(),
      karat: form.karat,
      grossWeight: gross,
      deductionWeight: deduction,
    };

    
try {
  setSaving(true);

  const response = await apiFetch("/api/gold-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Convert Fetch Response into JSON
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to create gold item."
    );
  }

  // Notify parent component
  onCreated?.(data.goldItem);

  setForm(initialForm);
} catch (err) {
  setError(err.message || "Something went wrong.");
} finally {
  setSaving(false);
}

  };

  return (
    <form className="gold-item-form" onSubmit={handleSubmit}>
      <h3>Register Gold Item</h3>

      {error && (
        <p className="gold-item-form__error" role="alert">
          {error}
        </p>
      )}

      <label htmlFor="gold-item-type">Item Type</label>
      <input
        id="gold-item-type"
        type="text"
        value={form.itemType}
        maxLength={100}
        onChange={(e) => updateField("itemType", e.target.value)}
        placeholder="Ring, Chain, Bracelet..."
        required
      />

      <label htmlFor="gold-description">Description</label>
      <textarea
        id="gold-description"
        value={form.description}
        maxLength={500}
        onChange={(e) => updateField("description", e.target.value)}
        placeholder="Gold item details"
      />

      <label htmlFor="gold-karat">Karat</label>
      <select
        id="gold-karat"
        value={form.karat}
        onChange={(e) => updateField("karat", e.target.value)}
      >
        {["18K", "21K", "22K", "24K", "OTHER"].map((karat) => (
          <option key={karat} value={karat}>
            {karat}
          </option>
        ))}
      </select>

      <label htmlFor="gold-gross-weight">Gross Weight (g)</label>
      <input
        id="gold-gross-weight"
        type="number"
        min="0.001"
        step="0.001"
        value={form.grossWeight}
        onChange={(e) => updateField("grossWeight", e.target.value)}
        required
      />

      <label htmlFor="gold-deduction-weight">
        Deduction Weight (g)
      </label>
      <input
        id="gold-deduction-weight"
        type="number"
        min="0"
        step="0.001"
        value={form.deductionWeight}
        onChange={(e) =>
          updateField("deductionWeight", e.target.value)
        }
        required
      />

      <p>
        <strong>Net Weight:</strong>{" "}
        {netWeight === null
          ? "—"
          : `${netWeight.toFixed(3)} g`}
      </p>

      <div className="gold-item-form__actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Gold Item"}
        </button>
      </div>
    </form>
  );
}
