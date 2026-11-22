
import { useEffect, useState } from "react";
import { apiFetch } from "../../../utils/api";

export default function CreatePawnLoanForm({
  onCreated,
  onCancel,
}) {
  const [customers, setCustomers] = useState([]);
  const [goldItems, setGoldItems] = useState([]);

  const [customerId, setCustomerId] = useState("");
  const [selectedGoldItems, setSelectedGoldItems] = useState([]);
  const [principalAmount, setPrincipalAmount] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);

        const [customerResponse, goldResponse] =
          await Promise.all([
            apiFetch("/api/customers?status=active"),
            apiFetch("/api/gold-items?status=draft&limit=100"),
          ]);

        const customerData = await customerResponse.json();
        const goldData = await goldResponse.json();

        if (
          !customerResponse.ok ||
          !customerData.success ||
          !goldResponse.ok ||
          !goldData.success
        ) {
          throw new Error("Failed to load form data.");
        }

        if (!active) return;

        setCustomers(
          customerData.customers.filter(
            (customer) => customer.status === "active"
          )
        );

        setGoldItems(
          goldData.goldItems.filter(
            (item) => item.reservedForLoan == null
          )
        );
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const toggleGoldItem = (itemId) => {
    setSelectedGoldItems((previous) =>
      previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const amount = Number(principalAmount);

    if (!customerId) {
      setError("Please select a customer.");
      return;
    }

    if (selectedGoldItems.length === 0) {
      setError("Please select at least one gold item.");
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(principalAmount.trim())
    ) {
      setError("Enter a valid principal amount (max 2 decimals).");
      return;
    }

    try {
      setSaving(true);

      const response = await apiFetch("/api/pawn-loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId,
          goldItemIds: selectedGoldItems,
          principalAmount: amount,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to create pawn loan."
        );
      }

      onCreated?.(data.pawnLoan);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>Loading customers and gold items...</p>;
  }

  return (
    <form className="gold-item-form" onSubmit={handleSubmit}>
      <h3>Create Draft Pawn Loan</h3>

      {error && (
        <p className="gold-item-form__error" role="alert">
          {error}
        </p>
      )}

      <label htmlFor="loan-customer">Customer</label>
      <select
        id="loan-customer"
        value={customerId}
        onChange={(event) =>
          setCustomerId(event.target.value)
        }
        required
      >
        <option value="">Select Customer</option>
        {customers.map((customer) => (
          <option key={customer._id} value={customer._id}>
            {customer.customerCode} - {customer.fullName}
          </option>
        ))}
      </select>

      <label>Available Gold Items</label>

      {goldItems.length === 0 ? (
        <p>No available gold items.</p>
      ) : (
        <div className="loan-gold-items">
          {goldItems.map((item) => (
            <label key={item._id}>
              <input
                type="checkbox"
                checked={selectedGoldItems.includes(item._id)}
                onChange={() => toggleGoldItem(item._id)}
              />
              {item.itemType} - {item.karat} -{" "}
              {item.netWeight} g
            </label>
          ))}
        </div>
      )}

      <label htmlFor="loan-principal">
        Principal Amount (LKR)
      </label>
      <input
        id="loan-principal"
        type="number"
        min="0.01"
        step="0.01"
        value={principalAmount}
        onChange={(event) =>
          setPrincipalAmount(event.target.value)
        }
        placeholder="Enter loan amount"
        required
      />

      <div className="gold-item-form__actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={
            saving ||
            customers.length === 0 ||
            goldItems.length === 0
          }
        >
          {saving ? "Creating..." : "Create Draft Loan"}
        </button>
      </div>
    </form>
  );
}
