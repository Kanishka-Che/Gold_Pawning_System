import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  X,
  RefreshCw,
  Eye,
  Pencil,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import "./Customers.scss";
import { apiFetch } from "../../../utils/api";
import { validateCustomerForm } from "../../../utils/customerValidation";


const emptyForm = {
  customerCode: "",
  fullName: "",
  nic: "",
  phone: "",
  address: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
  useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalMode, setModalMode] = useState("create");
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusCustomer, setStatusCustomer] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    setError("");

    try {
    const response = await apiFetch("/api/customers");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load customers");
      }

      setCustomers(data.customers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleView = async (customer) => {
    setError("");

    try {
     const response = await apiFetch(
  `/api/customers/${customer._id}`
);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load customer");
      }

      setSelectedCustomer(data.customer);
      setModalMode("view");
      setShowModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);

    setForm({
      customerCode: customer.customerCode,
      fullName: customer.fullName,
      nic: customer.nic,
      phone: customer.phone,
      address: customer.address,
    });

    setError("");
    setFieldErrors({});
    setModalMode("edit");
    setShowModal(true);
  };

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setForm(emptyForm);
    setError("");
    setFieldErrors({});
    setModalMode("create");
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    const errors = validateCustomerForm(form);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const isEdit = modalMode === "edit";

    if (isEdit && !selectedCustomer?._id) {
      setError("No customer selected for editing");
      return;
    }

    setSaving(true);

    try {
      const url = isEdit
  ? `/api/customers/${selectedCustomer._id}`
  : "/api/customers";

      const payload = {
        fullName: form.fullName.trim(),
        nic: form.nic.trim().toUpperCase(),
        phone: form.phone.replace(/[\s-]/g, "").trim(),
        address: form.address.trim(),
      };

      const response = await apiFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }

        throw new Error(data.message || "Failed to save customer");
      }

      setShowModal(false);
      setSelectedCustomer(null);
      setForm(emptyForm);
      setFieldErrors({});

      await fetchCustomers();

      setSuccess(
        isEdit
          ? "Customer updated successfully"
          : "Customer registered successfully",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusCustomer || statusSaving) return;

    const newStatus =
      statusCustomer.status === "active" ? "inactive" : "active";

    setStatusSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
  `/api/customers/${statusCustomer._id}/status`,
  {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update customer status");
      }

      setCustomers((prev) =>
        prev.map((customer) =>
          customer._id === statusCustomer._id ? data.customer : customer,
        ),
      );

      setSuccess(
        `Customer ${newStatus === "active" ? "activated" : "deactivated"} successfully`,
      );

      setStatusCustomer(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusSaving(false);
    }
  };

// Customer summary counts
const totalCustomers = customers.length;

const activeCustomers = customers.filter(
  (customer) => customer.status === "active"
).length;

const inactiveCustomers = customers.filter(
  (customer) => customer.status === "inactive"
).length;

// Apply search and status filters
const filteredCustomers = customers.filter(
  (customer) => {
    const query = search.trim().toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      customer.status === statusFilter;

    const matchesSearch =
      !query ||
      customer.fullName
        ?.toLowerCase()
        .includes(query) ||
      customer.customerCode
        ?.toLowerCase()
        .includes(query) ||
      customer.nic
        ?.toLowerCase()
        .includes(query) ||
      customer.phone?.includes(query);

    return matchesStatus && matchesSearch;
  }
);

  return (
    <div className="customers-page">
      <div className="customers-heading">
        <div>
          <h1>Customer Management</h1>
          <p>Manage registered pawning customers</p>
        </div>

        <button className="primary-btn" onClick={handleAddCustomer}>
          <UserPlus size={18} />
          Add Customer
        </button>
      </div>

     <div className="customer-summary-grid">
  {/* Total Customers */}
  <button
    type="button"
    className={`customer-summary ${
      statusFilter === "all"
        ? "selected-summary"
        : ""
    }`}
    onClick={() => setStatusFilter("all")}
    aria-pressed={statusFilter === "all"}
  >
    <div className="summary-icon total-icon">
      <Users size={25} />
    </div>

    <div className="summary-content">
      <span>Total Customers</span>
      <h2>{totalCustomers}</h2>
    </div>
  </button>

  {/* Active Customers */}
  <button
    type="button"
    className={`customer-summary ${
      statusFilter === "active"
        ? "selected-summary"
        : ""
    }`}
    onClick={() => setStatusFilter("active")}
    aria-pressed={statusFilter === "active"}
  >
    <div className="summary-icon active-icon">
      <UserRoundCheck size={25} />
    </div>

    <div className="summary-content">
      <span>Active Customers</span>
      <h2>{activeCustomers}</h2>
    </div>
  </button>

  {/* Inactive Customers */}
  <button
    type="button"
    className={`customer-summary ${
      statusFilter === "inactive"
        ? "selected-summary"
        : ""
    }`}
    onClick={() => setStatusFilter("inactive")}
    aria-pressed={statusFilter === "inactive"}
  >
    <div className="summary-icon inactive-icon">
      <UserRoundX size={25} />
    </div>

    <div className="summary-content">
      <span>Inactive Customers</span>
      <h2>{inactiveCustomers}</h2>
    </div>
  </button>
</div>

      {success && <div className="customer-success">{success}</div>}
      {error && <div className="customer-error">{error}</div>}

      <div className="customers-panel">
        <div className="customers-toolbar">
          <h3>
  {statusFilter === "active"
    ? "Active Customers"
    : statusFilter === "inactive"
      ? "Inactive Customers"
      : "All Customers"}
</h3>

          <div className="toolbar-actions">

<select
  className="customer-status-filter"
  value={statusFilter}
  onChange={(event) =>
    setStatusFilter(event.target.value)
  }
  aria-label="Filter customers by status"
>
  <option value="all">All Status</option>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
</select>

            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="refresh-btn"
              onClick={fetchCustomers}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {!loading && (
  <div className="customer-results-info">
    <span>
      Showing {filteredCustomers.length} of{" "}
      {totalCustomers} customers
    </span>

    {(search || statusFilter !== "all") && (
      <button
        type="button"
        className="clear-customer-filters"
        onClick={() => {
          setSearch("");
          setStatusFilter("all");
        }}
      >
        <X size={14} />
        Clear Filters
      </button>
    )}
  </div>
)}

        <div className="customers-table-wrapper">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Customer Code</th>
                <th>Full Name</th>
                <th>NIC</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer._id}>
                  <td className="customer-code">{customer.customerCode}</td>
                  <td>{customer.fullName}</td>
                  <td>{customer.nic}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.address}</td>
                  <td>
                    <span
                      className={`customer-status ${
                        customer.status === "active" ? "active" : "inactive"
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button
                        className="action-btn view"
                        title="View Customer"
                        aria-label={`View ${customer.fullName}`}
                        onClick={() => handleView(customer)}
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        className="action-btn edit"
                        title="Edit Customer"
                        aria-label={`Edit ${customer.fullName}`}
                        onClick={() => handleEdit(customer)}
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        type="button"
                        className={`action-btn ${
                          customer.status === "active"
                            ? "deactivate"
                            : "activate"
                        }`}
                        title={
                          customer.status === "active"
                            ? "Deactivate Customer"
                            : "Activate Customer"
                        }
                        aria-label={
                          customer.status === "active"
                            ? `Deactivate ${customer.fullName}`
                            : `Activate ${customer.fullName}`
                        }
                        onClick={() => setStatusCustomer(customer)}
                      >
                        {customer.status === "active" ? (
                          <UserRoundX size={17} />
                        ) : (
                          <UserRoundCheck size={17} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-customers">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading && <p className="loading-text">Loading customers...</p>}
        </div>
      </div>

      {showModal && (
        <div className="customer-modal-overlay">
          <div className="customer-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {modalMode === "view"
                    ? "Customer Details"
                    : modalMode === "edit"
                      ? "Edit Customer"
                      : "Register New Customer"}
                </h2>
                <p>
                  {modalMode === "view"
                    ? "View registered customer information"
                    : "Enter customer information"}
                </p>
              </div>

              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {modalMode === "view" ? (
              <div className="customer-details">
                {[
                  ["Customer Code", selectedCustomer?.customerCode],
                  ["Full Name", selectedCustomer?.fullName],
                  ["NIC", selectedCustomer?.nic],
                  ["Phone", selectedCustomer?.phone],
                  ["Address", selectedCustomer?.address],
                  ["Status", selectedCustomer?.status],
                ].map(([label, value]) => (
                  <div className="detail-row" key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}

                <div className="modal-actions">
                  <button
                    className="cancel-btn"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>

                  <button
                    className="primary-btn"
                    onClick={() => handleEdit(selectedCustomer)}
                  >
                    <Pencil size={16} />
                    Edit Customer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="customer-error" role="alert">
                    {error}
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label>Customer Code</label>

                    <input
                      type="text"
                      value={
                        modalMode === "edit"
                          ? form.customerCode
                          : "Auto Generated"
                      }
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="customer-fullname">Full Name *</label>
                    <input
                      id="customer-fullname"
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      className={fieldErrors.fullName ? "input-error" : ""}
                      aria-invalid={!!fieldErrors.fullName}
                    />
                    {fieldErrors.fullName && (
                      <span className="field-error">
                        {fieldErrors.fullName}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="customer-nic">NIC *</label>
                    <input
                      id="customer-nic"
                      name="nic"
                      value={form.nic}
                      onChange={handleChange}
                      placeholder="991234567V or 199912345678"
                      className={fieldErrors.nic ? "input-error" : ""}
                      aria-invalid={!!fieldErrors.nic}
                    />
                    {fieldErrors.nic && (
                      <span className="field-error">{fieldErrors.nic}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="customer-phone">Phone *</label>
                    <input
                      id="customer-phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="0771234567"
                      className={fieldErrors.phone ? "input-error" : ""}
                      aria-invalid={!!fieldErrors.phone}
                    />
                    {fieldErrors.phone && (
                      <span className="field-error">{fieldErrors.phone}</span>
                    )}
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="customer-address">Address *</label>
                    <textarea
                      id="customer-address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      rows={3}
                      className={fieldErrors.address ? "input-error" : ""}
                      aria-invalid={!!fieldErrors.address}
                    />
                    {fieldErrors.address && (
                      <span className="field-error">{fieldErrors.address}</span>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : modalMode === "edit"
                        ? "Save Changes"
                        : "Register Customer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {statusCustomer && (
        <div className="customer-modal-overlay">
          <div className="customer-modal status-confirm-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {statusCustomer.status === "active"
                    ? "Deactivate Customer"
                    : "Activate Customer"}
                </h2>
                <p>Confirm customer status change</p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setStatusCustomer(null)}
                disabled={statusSaving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <p className="status-confirm-text">
              Are you sure you want to{" "}
              <strong>
                {statusCustomer.status === "active" ? "deactivate" : "activate"}
              </strong>{" "}
              customer <strong>{statusCustomer.fullName}</strong> (
              {statusCustomer.customerCode})?
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setStatusCustomer(null)}
                disabled={statusSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={handleStatusChange}
                disabled={statusSaving}
              >
                {statusSaving
                  ? "Updating..."
                  : statusCustomer.status === "active"
                    ? "Yes, Deactivate"
                    : "Yes, Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
