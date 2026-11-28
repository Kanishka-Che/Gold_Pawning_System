
import { useEffect, useRef, useState } from "react";

import {
  UserRound,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  LockKeyhole,
} from "lucide-react";

import {
  getMyProfile,
  changeMyPassword,
} from "../../../utils/authApi.js";

import UserAvatar from
  "../../../components/UserAvatar/UserAvatar.jsx";

import ProfileImageEditor from
  "../../../components/ProfileImageEditor/ProfileImageEditor.jsx";

import "./Profile.scss";

const emptyForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function Profile({
  mode = "profile",
  onNavigate,
  onSessionEnded,
  onProfileUpdated,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profileError, setProfileError] =
    useState("");

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    ...emptyForm,
  });

  const [visiblePasswords, setVisiblePasswords] =
    useState({});

  const savingRef = useRef(false);
  const requestVersion = useRef(0);

  const loadProfile = async () => {
    const version = ++requestVersion.current;

    setLoading(true);
    setProfileError("");

    try {
      const data = await getMyProfile();

      if (version === requestVersion.current) {
        setProfile(data.user);
      }
    } catch (err) {
      if (version !== requestVersion.current) {
        return;
      }

      if (err.status === 401) {
        onSessionEnded();
        return;
      }

      setProfileError(err.message);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadProfile();

    return () => {
      requestVersion.current++;
    };
  }, []);

  useEffect(() => {
    setForm({ ...emptyForm });
    setVisiblePasswords({});
    setError("");
  }, [mode]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const togglePassword = (field) => {
    setVisiblePasswords((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (savingRef.current) return;

    setError("");

    if (!form.currentPassword) {
      setError("Current password is required.");
      return;
    }

    if (
      new TextEncoder().encode(
        form.currentPassword
      ).length > 72
    ) {
      setError("Invalid current password.");
      return;
    }

    if (form.newPassword.length < 12) {
      setError(
        "New password must contain at least 12 characters."
      );
      return;
    }

    if (
      new TextEncoder().encode(
        form.newPassword
      ).length > 72
    ) {
      setError(
        "Password must not exceed 72 UTF-8 bytes."
      );
      return;
    }

    if (!form.newPassword.trim()) {
      setError(
        "Password cannot contain only whitespace."
      );
      return;
    }

    if (
      form.currentPassword === form.newPassword
    ) {
      setError(
        "New password must be different from current password."
      );
      return;
    }

    if (
      form.newPassword !== form.confirmPassword
    ) {
      setError("Passwords do not match.");
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const result = await changeMyPassword(form);

      setForm({ ...emptyForm });
      setVisiblePasswords({});

      if (result.requiresLogin) {
        alert(result.message);
        onSessionEnded();
      }
    } catch (err) {
      if (err.status === 401) {
        onSessionEnded();
        return;
      }

      setError(err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

const handleProfileUpdated = (updatedUser) => {
  setProfile((previous) => ({
    ...previous,
    ...updatedUser,
  }));

  onProfileUpdated?.(updatedUser);
};

  const formatDate = (value) => {
    if (!value) return "—";

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Colombo",
    }).format(new Date(value));
  };

  const passwordFields = [
    {
      name: "currentPassword",
      label: "Current Password",
      placeholder: "Enter current password",
      autoComplete: "current-password",
    },
    {
      name: "newPassword",
      label: "New Password",
      placeholder: "Enter new password",
      autoComplete: "new-password",
    },
    {
      name: "confirmPassword",
      label: "Confirm New Password",
      placeholder: "Confirm new password",
      autoComplete: "new-password",
    },
  ];

  if (loading) {
    return (
      <div className="account-profile">
        <div className="ap-panel">
          Loading account information...
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="account-profile">
        <div className="ap-panel">
          <div className="ap-error">
            <AlertCircle size={18} />

            {profileError ||
              "Unable to load profile"}
          </div>

          <button
            type="button"
            className="ap-primary-btn"
            onClick={loadProfile}
          >
            <RefreshCw size={17} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const roleLabel =
    profile.role === "admin"
      ? "Administrator"
      : "Staff / Cashier";

  return (
    <div className="account-profile">
      <div className="ap-page-header">
        <h1>
          {mode === "password"
            ? "Change Password"
            : "My Profile"}
        </h1>

        <p>
          Manage your account information and
          security settings
        </p>
      </div>

      <div className="ap-tabs">
        <button
          type="button"
          className={
            mode === "profile" ? "active" : ""
          }
          disabled={saving}
          onClick={() =>
            onNavigate("My Profile")
          }
        >
          <UserRound size={18} />
          My Profile
        </button>

        <button
          type="button"
          className={
            mode === "password" ? "active" : ""
          }
          disabled={saving}
          onClick={() =>
            onNavigate("Change Password")
          }
        >
          <KeyRound size={18} />
          Change Password
        </button>
      </div>

      {mode === "profile" ? (
        <>
          <section className="ap-panel">
            <div className="ap-profile-header">
              <UserAvatar
  user={profile}
  size={85}
/>

              <div>
                <h2>{profile.username}</h2>

                <span className="ap-role">
                  <ShieldCheck size={17} />
                  {roleLabel}
                </span>

                <span className="ap-active">
                  {profile.isActive
                    ? "Active Account"
                    : "Inactive Account"}
                </span>
              </div>
            </div>

            <ProfileImageEditor
  user={profile}
  onUpdated={handleProfileUpdated}
  onSessionEnded={onSessionEnded}
/>

            <div className="ap-details">
              <div>
                <span>Username</span>
                <strong>{profile.username}</strong>
              </div>

              <div>
                <span>Account Role</span>
                <strong>{roleLabel}</strong>
              </div>

              <div>
                <span>Account Status</span>
                <strong>
                  {profile.isActive
                    ? "Active"
                    : "Inactive"}
                </strong>
              </div>

              <div>
                <span>Created Date</span>
                <strong>
                  {formatDate(profile.createdAt)}
                </strong>
              </div>

              <div>
                <span>Last Account Update</span>
                <strong>
                  {formatDate(profile.updatedAt)}
                </strong>
              </div>
            </div>
          </section>

          <section className="ap-panel">
            <div className="ap-security-header">
              <LockKeyhole size={28} />

              <div>
                <h2>Account Security</h2>
                <p>
                  Keep your account secure by
                  using a strong password.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="ap-primary-btn"
              onClick={() =>
                onNavigate("Change Password")
              }
            >
              <KeyRound size={17} />
              Change Password
            </button>
          </section>
        </>
      ) : (
        <section className="ap-panel">
          <h2 className="ap-section-title">
            Update Your Password
          </h2>

          {error && (
            <div className="ap-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form
            className="ap-password-form"
            onSubmit={handleSubmit}
          >
            {passwordFields.map((field) => (
              <div
                className="ap-field"
                key={field.name}
              >
                <label htmlFor={field.name}>
                  {field.label}
                </label>

                <div className="ap-password-input">
                  <input
                    id={field.name}
                    name={field.name}
                    type={
                      visiblePasswords[field.name]
                        ? "text"
                        : "password"
                    }
                    value={form[field.name]}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    onChange={handleChange}
                    maxLength={72}
                    required
                    disabled={saving}
                  />

                  <button
                    type="button"
                    disabled={saving}
                    aria-label={
                      visiblePasswords[field.name]
                        ? `Hide ${field.label}`
                        : `Show ${field.label}`
                    }
                    onClick={() =>
                      togglePassword(field.name)
                    }
                  >
                    {visiblePasswords[field.name] ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>

                {field.name === "newPassword" && (
                  <small>
                    Minimum 12 characters.
                    Maximum 72 UTF-8 bytes.
                  </small>
                )}
              </div>
            ))}

            <div className="ap-security-notice">
              <ShieldCheck size={22} />

              <p>
                Changing your password will revoke
                your existing login sessions.
                You will need to login again.
              </p>
            </div>

            <div className="ap-form-actions">
              <button
                type="button"
                className="ap-secondary-btn"
                disabled={saving}
                onClick={() =>
                  onNavigate("My Profile")
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="ap-primary-btn"
                disabled={saving}
              >
                <KeyRound size={17} />

                {saving
                  ? "Changing Password..."
                  : "Change Password"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
