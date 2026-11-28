
import { useEffect, useRef, useState } from "react";

import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  ShieldCheck,
  Search,
  RefreshCw,
  KeyRound,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

import {
  getUsers,
  createUser,
  updateUserStatus,
  updateUserRole,
  resetUserPassword,
} from "../../../utils/userApi.js";

import UserAvatar from
  "../../../components/UserAvatar/UserAvatar.jsx";

import "./UserManagement.scss";

const emptyForm = {
  username: "",
  password: "",
  confirmPassword: "",
  role: "staff",
};

function validatePassword(password, confirmPassword) {
  if (password.length < 12) {
    return "Password must contain at least 12 characters.";
  }

  if (new TextEncoder().encode(password).length > 72) {
    return "Password must not exceed 72 UTF-8 bytes.";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return "";
}

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const requestVersion = useRef(0);
  const savingRef = useRef(false);
  const dialogRef = useRef(null);

  const fetchUsers = async () => {
    const version = ++requestVersion.current;

    setLoading(true);
    setError("");

    try {
      const data = await getUsers();

      if (version === requestVersion.current) {
        setUsers(data.users || []);
      }
    } catch (err) {
      if (version === requestVersion.current) {
        setError(err.message);
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchUsers();

    return () => {
      requestVersion.current++;
    };
  }, []);

  useEffect(() => {
    if (modal && dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, [modal]);

  const getUserId = (user) =>
    String(user?._id || user?.id || "");

  const isCurrentUser = (user) =>
    getUserId(user) === getUserId(currentUser);

  const totalUsers = users.length;

  const activeUsers = users.filter(
    (user) => user.isActive
  ).length;

  const inactiveUsers = users.filter(
    (user) => !user.isActive
  ).length;

  const adminUsers = users.filter(
    (user) => user.role === "admin"
  ).length;

  const activeAdmins = users.filter(
    (user) =>
      user.role === "admin" && user.isActive
  ).length;

  const isLastActiveAdmin = (user) =>
    user.role === "admin" &&
    user.isActive &&
    activeAdmins <= 1;

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesRole =
      roleFilter === "all" ||
      user.role === roleFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);

    return (
      matchesSearch &&
      matchesRole &&
      matchesStatus
    );
  });

  const openModal = (type, user = null) => {
    if (savingRef.current) return;

    setError("");
    setSuccess("");
    setModalError("");

    setForm({
      ...emptyForm,
      role: user?.role || "staff",
    });

    setModal({ type, user });
  };

  const closeModal = () => {
    if (savingRef.current) return;

    dialogRef.current?.close();

    setModal(null);
    setModalError("");
    setForm({ ...emptyForm });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setModalError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!modal || savingRef.current) return;

    setModalError("");

    const { type, user } = modal;

    if (type === "create") {
      if (
        !/^[a-zA-Z0-9._-]{3,30}$/.test(
          form.username.trim()
        )
      ) {
        setModalError(
          "Username must be 3-30 characters."
        );
        return;
      }
    }

    if (type === "create" || type === "password") {
      const passwordError = validatePassword(
        form.password,
        form.confirmPassword
      );

      if (passwordError) {
        setModalError(passwordError);
        return;
      }
    }

    if (user && isCurrentUser(user)) {
      setModalError(
        "This action is not allowed on your own account."
      );
      return;
    }

    if (
      user &&
      isLastActiveAdmin(user) &&
      (
        type === "status" ||
        (type === "role" && form.role === "staff")
      )
    ) {
      setModalError(
        "Cannot remove the last active administrator."
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      let result;

      switch (type) {
        case "create":
          result = await createUser({
            username: form.username
              .trim()
              .toLowerCase(),
            password: form.password,
            role: form.role,
          });
          break;

        case "status":
          result = await updateUserStatus(
            getUserId(user),
            !user.isActive
          );
          break;

        case "role":
          result = await updateUserRole(
            getUserId(user),
            form.role
          );
          break;

        case "password":
          result = await resetUserPassword(
            getUserId(user),
            form.password
          );
          break;

        default:
          throw new Error("Invalid user action");
      }

      setSuccess(
        result.message || "Operation successful"
      );

      dialogRef.current?.close();

      setModal(null);
      setForm({ ...emptyForm });

      await fetchUsers();
    } catch (err) {
      setModalError(err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "Asia/Colombo",
    }).format(new Date(value));
  };

  const modalTitle = {
    create: "Add New User",
    status: modal?.user?.isActive
      ? "Deactivate User"
      : "Activate User",
    role: "Change User Role",
    password: "Reset User Password",
  };

  const summaryCards = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      className: "total",
      onClick: () => {
        setSearch("");
        setRoleFilter("all");
        setStatusFilter("all");
      },
    },
    {
      label: "Active Users",
      value: activeUsers,
      icon: UserCheck,
      className: "active",
      onClick: () => {
        setRoleFilter("all");
        setStatusFilter("active");
      },
    },
    {
      label: "Inactive Users",
      value: inactiveUsers,
      icon: UserX,
      className: "inactive",
      onClick: () => {
        setRoleFilter("all");
        setStatusFilter("inactive");
      },
    },
    {
      label: "Administrators",
      value: adminUsers,
      icon: ShieldCheck,
      className: "admin",
      onClick: () => {
        setRoleFilter("admin");
        setStatusFilter("all");
      },
    },
  ];

  if (currentUser?.role !== "admin") {
    return (
      <div className="user-management">
        <div className="um-alert error">
          <AlertCircle size={20} />
          Access denied. Administrator access required.
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Page Header */}

      <div className="um-page-header">
        <div>
          <h1>User Management</h1>

          <p>
            Manage system users and access permissions
          </p>
        </div>

        <button
          type="button"
          className="um-primary-btn"
          onClick={() => openModal("create")}
          disabled={saving || loading || !!error}
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Notifications */}

      {error && (
        <div className="um-alert error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="um-alert success" role="status">
          <CheckCircle size={19} />
          <span>{success}</span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setSuccess("")}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary Cards */}

      <div className="um-summary-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              type="button"
              key={card.label}
              className={`um-summary-card ${card.className}`}
              onClick={card.onClick}
            >
              <div className="um-summary-icon">
                <Icon size={25} />
              </div>

              <div>
                <span>{card.label}</span>
                <strong>
                  {loading || error ? "—" : card.value}
                </strong>
              </div>
            </button>
          );
        })}
      </div>

      {/* Users Table */}

      <section className="um-panel">
        <div className="um-panel-header">
          <div>
            <h2>System Users</h2>

            <p>
              {loading || error
                ? "User records"
                : `${filteredUsers.length} of ${totalUsers} users`}
            </p>
          </div>

          <div className="um-filters">
            <div className="um-search">
              <Search size={18} />

              <input
                type="search"
                placeholder="Search username..."
                aria-label="Search username"
                value={search}
                maxLength={100}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              className="um-icon-btn"
              title="Clear filters"
              aria-label="Clear filters"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
            >
              <X size={18} />
            </button>

            <button
              type="button"
              className="um-icon-btn"
              title="Refresh users"
              aria-label="Refresh users"
              disabled={loading || saving}
              onClick={fetchUsers}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="um-table-wrapper">
          <table className="um-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="um-empty">
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="um-empty">
                    Unable to load users. Please refresh.
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="um-empty">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={getUserId(user)}>
                    <td>
                      <div className="um-username">
                        <UserAvatar
  user={user}
  size={34}
/>

                        <strong>{user.username}</strong>

                        {isCurrentUser(user) && (
                          <span className="um-you">
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`um-role ${user.role}`}
                      >
                        {user.role === "admin"
                          ? "Administrator"
                          : "Staff"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`um-status ${
                          user.isActive
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {user.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>{formatDate(user.createdAt)}</td>

                    <td>
                      {isCurrentUser(user) ? (
                        <span className="um-own-account">
                          Current account
                        </span>
                      ) : (
                        <div className="um-actions">
                          <button
                            type="button"
                            className="um-icon-btn gold"
                            title="Change role"
                            aria-label={`Change role for ${user.username}`}
                            disabled={
                              saving ||
                              isLastActiveAdmin(user)
                            }
                            onClick={() =>
                              openModal("role", user)
                            }
                          >
                            <ShieldCheck size={17} />
                          </button>

                          <button
                            type="button"
                            className="um-icon-btn gold"
                            title="Reset password"
                            aria-label={`Reset password for ${user.username}`}
                            disabled={saving}
                            onClick={() =>
                              openModal("password", user)
                            }
                          >
                            <KeyRound size={17} />
                          </button>

                          <button
                            type="button"
                            className={`um-icon-btn ${
                              user.isActive
                                ? "danger"
                                : "green"
                            }`}
                            title={
                              user.isActive
                                ? "Deactivate user"
                                : "Activate user"
                            }
                            aria-label={`${
                              user.isActive
                                ? "Deactivate"
                                : "Activate"
                            } ${user.username}`}
                            disabled={
                              saving ||
                              isLastActiveAdmin(user)
                            }
                            onClick={() =>
                              openModal("status", user)
                            }
                          >
                            {user.isActive ? (
                              <UserX size={17} />
                            ) : (
                              <UserCheck size={17} />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* User Management Modal */}

      {modal && (
        <dialog
          ref={dialogRef}
          className="um-modal"
          aria-labelledby="um-modal-title"
          onCancel={(event) => {
            event.preventDefault();
            closeModal();
          }}
        >
          <div className="um-modal-header">
            <h2 id="um-modal-title">
              {modalTitle[modal.type]}
            </h2>

            <button
              type="button"
              className="um-icon-btn"
              aria-label="Close dialog"
              disabled={saving}
              onClick={closeModal}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="um-modal-body">
              {modalError && (
                <div
                  className="um-alert error"
                  role="alert"
                >
                  <AlertCircle size={18} />
                  <span>{modalError}</span>
                </div>
              )}

              {modal.user && (
                <div className="um-selected-user">
                  <span>Selected User</span>
                  <strong>{modal.user.username}</strong>
                </div>
              )}

              {modal.type === "create" && (
                <label>
                  Username

                  <input
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="Enter username"
                    minLength={3}
                    maxLength={30}
                    autoComplete="off"
                    required
                    disabled={saving}
                  />

                  <small>
                    Letters, numbers, dots, underscores
                    and hyphens.
                  </small>
                </label>
              )}

              {(modal.type === "create" ||
                modal.type === "role") && (
                <label>
                  User Role

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    disabled={saving}
                  >
                    <option value="staff">
                      Staff / Cashier
                    </option>

                    <option value="admin">
                      Administrator
                    </option>
                  </select>

                  {form.role === "admin" && (
                    <small className="um-warning-text">
                      Administrators have full user
                      management permissions.
                    </small>
                  )}
                </label>
              )}

              {(modal.type === "create" ||
                modal.type === "password") && (
                <>
                  <label>
                    {modal.type === "create"
                      ? "Password"
                      : "New Password"}

                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      minLength={12}
                      maxLength={72}
                      autoComplete="new-password"
                      required
                      disabled={saving}
                    />

                    <small>
                      Minimum 12 characters.
                      Maximum 72 UTF-8 bytes.
                    </small>
                  </label>

                  <label>
                    Confirm Password

                    <input
                      type="password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      required
                      disabled={saving}
                    />
                  </label>
                </>
              )}

              {modal.type === "status" && (
                <div className="um-confirmation">
                  <p>
                    Are you sure you want to{" "}
                    {modal.user.isActive
                      ? "deactivate"
                      : "activate"}{" "}
                    <strong>
                      {modal.user.username}
                    </strong>
                    ?
                  </p>

                  <small>
                    {modal.user.isActive
                      ? "Existing login sessions will be revoked and the user will no longer be able to log in."
                      : "The user will be allowed to log in again."}
                  </small>
                </div>
              )}

              {(modal.type === "role" ||
                modal.type === "password") && (
                <div className="um-warning">
                  <AlertCircle size={18} />

                  <span>
                    Existing login sessions will be
                    revoked when the change is applied.
                  </span>
                </div>
              )}
            </div>

            <div className="um-modal-footer">
              <button
                type="button"
                className="um-secondary-btn"
                disabled={saving}
                onClick={closeModal}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="um-primary-btn"
                disabled={
                  saving ||
                  (modal.type === "role" &&
                    form.role === modal.user.role)
                }
              >
                {saving
                  ? "Saving..."
                  : modal.type === "create"
                    ? "Create User"
                    : modal.type === "password"
                      ? "Reset Password"
                      : modal.type === "status"
                        ? modal.user.isActive
                          ? "Deactivate"
                          : "Activate"
                        : "Save Changes"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
