import { useEffect, useRef, useState } from "react";

import {
  Store,
  Pencil,
  Save,
  X,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";
import { apiFetch } from "../../../utils/api.js";
import "./ShopSettings.scss";

const MAX_LOGO_SIZE = 10 * 1024 * 1024;

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const shopFields = [
  {
    name: "name",
    label: "Shop Name",
    maxLength: 150,
    required: true,
  },
  {
    name: "address",
    label: "Shop Address",
    maxLength: 500,
    multiline: true,
  },
  {
    name: "contactNumber",
    label: "Contact Number",
    type: "tel",
    maxLength: 50,
  },
  {
    name: "email",
    label: "Email Address",
    type: "email",
    maxLength: 150,
  },
  {
    name: "registrationNumber",
    label: "Registration Number",
    maxLength: 100,
  },
];

const getShopForm = (settings) => ({
  name: settings?.shop?.name ?? "",
  address: settings?.shop?.address ?? "",
  contactNumber: settings?.shop?.contactNumber ?? "",
  email: settings?.shop?.email ?? "",
  registrationNumber:
    settings?.shop?.registrationNumber ?? "",
});

export default function ShopSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [configured, setConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const logoInputRef = useRef(null);

const [selectedLogo, setSelectedLogo] =
  useState(null);

const [logoPreviewUrl, setLogoPreviewUrl] =
  useState("");

const [savedLogoUrl, setSavedLogoUrl] =
  useState("");

const [removeLogoRequested, setRemoveLogoRequested] =
  useState(false);

const [logoLoading, setLogoLoading] =
  useState(false);

const [logoError, setLogoError] =
  useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await apiFetch(
          "/api/system-settings"
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.settings) {
          throw new Error(
            data.message || "Failed to load shop settings."
          );
        }

        if (!cancelled) {
          setSettings(data.settings);
          setConfigured(data.configured === true);
          setForm(getShopForm(data.settings));
          setEditing(false);
          setConflict(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setSettings(null);
          setForm(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const logoPath = settings?.shop?.logoUrl || "";

useEffect(() => {
  let cancelled = false;
  let objectUrl = "";

  const controller = new AbortController();

  setSavedLogoUrl("");
  setLogoError("");
  setLogoLoading(Boolean(logoPath));

  async function loadSavedLogo() {
    if (!logoPath) return;

    try {
      const validLogoPath =
        /^\/api\/system-settings\/logos\/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

      if (!validLogoPath.test(logoPath)) {
        throw new Error("Invalid saved logo path.");
      }

      const response = await apiFetch(logoPath, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to load shop logo.");
      }

      const blob = await response.blob();

      if (blob.type !== "image/png") {
        throw new Error("Invalid saved logo image.");
      }

      if (!cancelled) {
        objectUrl = URL.createObjectURL(blob);
        setSavedLogoUrl(objectUrl);
      }
    } catch (err) {
      if (!cancelled) {
        setLogoError(err.message);
      }
    } finally {
      if (!cancelled) {
        setLogoLoading(false);
      }
    }
  }

  loadSavedLogo();

  return () => {
    cancelled = true;

    controller.abort();

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  };
}, [logoPath, reloadKey]);

useEffect(() => {
  if (!selectedLogo) {
    setLogoPreviewUrl("");
    return;
  }

  const objectUrl =
    URL.createObjectURL(selectedLogo);

  setLogoPreviewUrl(objectUrl);

  return () => {
    URL.revokeObjectURL(objectUrl);
  };
}, [selectedLogo]);

const displayLogoUrl = removeLogoRequested
  ? ""
  : selectedLogo
    ? logoPreviewUrl
    : savedLogoUrl;

const clearLogoSelection = () => {
  setSelectedLogo(null);
  setLogoPreviewUrl("");
  setRemoveLogoRequested(false);

  if (logoInputRef.current) {
    logoInputRef.current.value = "";
  }
};

const handleLogoSelect = (event) => {
  if (!editing || saving || conflict) return;

  const file = event.target.files?.[0];

  if (!file) return;

  console.log("Selected Logo:", {
  fileName: file.name,
  fileType: file.type,
  fileSizeBytes: file.size,
  fileSizeMB: file.size / 1024 / 1024,
  maximumBytes: MAX_LOGO_SIZE,
  maximumMB: MAX_LOGO_SIZE / 1024 / 1024,
  exceedsLimit: file.size > MAX_LOGO_SIZE,
});

  setError("");
  setSuccess("");
  setLogoError("");

  event.target.value = "";

  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    setLogoError(
      "Only PNG, JPG, JPEG and WEBP images are allowed."
    );
    return;
  }

  if (file.size === 0) {
    setLogoError("Selected image is empty.");
    return;
  }

  if (file.size > MAX_LOGO_SIZE) {
    setLogoError(
      "Logo image must not exceed 10 MB."
    );
    return;
  }

  setSelectedLogo(file);
  setRemoveLogoRequested(false);
};

const handleLogoRemove = () => {
  if (!editing || saving || conflict) return;

  setSelectedLogo(null);
  setLogoPreviewUrl("");
  setRemoveLogoRequested(Boolean(logoPath));

  setLogoError("");
  setError("");
  setSuccess("");

  if (logoInputRef.current) {
    logoInputRef.current.value = "";
  }
};

const handleLogoUndo = () => {
  if (!editing || saving) return;

  clearLogoSelection();
  setLogoError("");
};


  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleEdit = () => {
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const handleCancel = () => {
  if (saving) return;

  setForm(getShopForm(settings));

  clearLogoSelection();

  setEditing(false);
  setError(
    conflict
      ? "Settings have changed. Reload settings before editing."
      : ""
  );
  setSuccess("");
  setLogoError("");
};

const handleReload = () => {
  if (saving) return;

  if (
    editing &&
    !window.confirm(
      "Discard unsaved changes and reload settings?"
    )
  ) {
    return;
  }

  clearLogoSelection();
  setLogoError("");

  setReloadKey((previous) => previous + 1);
};

const handleSave = async (event) => {
  event.preventDefault();

  if (
    saving ||
    !editing ||
    !settings ||
    !form ||
    conflict
  ) {
    return;
  }

  setError("");
  setSuccess("");
  setLogoError("");

  const shop = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      value.trim(),
    ])
  );

  if (!shop.name) {
    setError("Shop name is required.");
    return;
  }

  for (const field of shopFields) {
    if (shop[field.name].length > field.maxLength) {
      setError(
        `${field.label} must not exceed ${field.maxLength} characters.`
      );
      return;
    }
  }

  if (
    shop.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shop.email)
  ) {
    setError("Enter a valid email address.");
    return;
  }

  const current = getShopForm(settings);

  const hasShopChanges = Object.entries(shop).some(
    ([key, value]) => current[key] !== value
  );

  const hasLogoChanges =
    Boolean(selectedLogo) || removeLogoRequested;

  if (
    configured &&
    !hasShopChanges &&
    !hasLogoChanges
  ) {
    setEditing(false);
    setSuccess("No changes to save.");
    return;
  }

  setSaving(true);

  let latestSettings = settings;
  let shopSaved = false;
  let logoSaved = false;

  const applySettings = (data) => {
    latestSettings = data.settings;

    setSettings(data.settings);
    setConfigured(data.configured === true);
    setForm(getShopForm(data.settings));
  };

  const readResponse = async (response) => {
    const data = await response.json();

    if (response.status === 409) {
      setConflict(true);

      throw new Error(
        "Settings were changed by another Admin. Reload settings before saving."
      );
    }

    if (
      !response.ok ||
      !data.success ||
      !data.settings
    ) {
      throw new Error(
        data.message || "Failed to save settings."
      );
    }

    return data;
  };

  try {
    // 1. Save shop information
    if (!configured || hasShopChanges) {
      const response = await apiFetch(
        "/api/system-settings",
        {
          method: "PUT",
          body: JSON.stringify({
            expectedVersion: latestSettings.version,
            shop,
          }),
        }
      );

      const data = await readResponse(response);

      applySettings(data);

      shopSaved = true;
    }

    // 2. Upload or replace logo
    if (selectedLogo) {
      const formData = new FormData();

      formData.append("logo", selectedLogo);

      formData.append(
        "expectedVersion",
        String(latestSettings.version)
      );

      const response = await apiFetch(
        "/api/system-settings/logo",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await readResponse(response);

      applySettings(data);

      logoSaved = true;

      clearLogoSelection();
    }

    // 3. Remove existing logo
    else if (removeLogoRequested) {
      const response = await apiFetch(
        "/api/system-settings/logo",
        {
          method: "DELETE",
          body: JSON.stringify({
            expectedVersion: latestSettings.version,
          }),
        }
      );

      const data = await readResponse(response);

      applySettings(data);

      logoSaved = true;

      clearLogoSelection();
    }

    setEditing(false);
    setConflict(false);

    setSuccess(
      "Shop settings saved successfully."
    );
  } catch (err) {
    if (shopSaved && !logoSaved && hasLogoChanges) {
      setError(
        `Shop information was saved, but the logo change failed: ${err.message}`
      );
    } else {
      setError(err.message);
    }
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <div className="shop-settings-page">
        <p role="status">Loading shop settings...</p>
      </div>
    );
  }

  if (!settings || !form) {
    return (
      <div className="shop-settings-page">
        <div className="shop-settings-error" role="alert">
          {error || "Shop settings could not be loaded."}
        </div>

        <button
          type="button"
          onClick={handleReload}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="shop-settings-page">
      <div className="shop-settings-header">
        <div className="shop-settings-heading">
          <Store size={26} />

          <div>
            <h2>Shop Information</h2>
            <p>
              Manage business information and branding.
            </p>
          </div>
        </div>

        <span className="shop-settings-version">
          Version {settings.version}
        </span>
      </div>

      {!configured && (
        <div className="shop-settings-notice">
          Shop settings have not been configured yet.
          Edit and save to complete the initial setup.
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="shop-settings-fields">
          {shopFields.map((field) => (
            <div
              key={field.name}
              className="shop-settings-field"
            >
              <label htmlFor={`shop-${field.name}`}>
                {field.label}
                {field.required && " *"}
              </label>

              {field.multiline ? (
                <textarea
                  id={`shop-${field.name}`}
                  rows={3}
                  maxLength={field.maxLength}
                  value={form[field.name]}
                  disabled={!editing || saving}
                  onChange={(event) =>
                    updateField(
                      field.name,
                      event.target.value
                    )
                  }
                />
              ) : (
                <input
                  id={`shop-${field.name}`}
                  type={field.type || "text"}
                  value={form[field.name]}
                  maxLength={field.maxLength}
                  required={field.required}
                  disabled={!editing || saving}
                  onChange={(event) =>
                    updateField(
                      field.name,
                      event.target.value
                    )
                  }
                />
              )}
            </div>
                   ))}

          <div className="shop-settings-field shop-logo-field">
            <label htmlFor="shop-logo-input">
              Shop Logo
            </label>

            <div className="shop-logo-upload-box">
              <div className="shop-logo-preview">
                {displayLogoUrl ? (
                  <img
                    key={displayLogoUrl}
                    src={displayLogoUrl}
                    alt="Shop logo"
                    onError={() => {
                      if (selectedLogo) {
                        clearLogoSelection();

                        setLogoError(
                          "Selected image could not be displayed."
                        );
                      } else {
                        setSavedLogoUrl("");

                        setLogoError(
                          "Saved logo could not be displayed."
                        );
                      }
                    }}
                  />
                ) : (
                  <div className="shop-logo-placeholder">
                    <ImageIcon size={36} />

                    <span>
                      {removeLogoRequested
                        ? "Logo marked for removal"
                        : logoLoading
                          ? "Loading logo..."
                          : logoPath
                            ? "Logo unavailable"
                            : "No logo uploaded"}
                    </span>
                  </div>
                )}
              </div>

              <div className="shop-logo-controls">
                <input
                  id="shop-logo-input"
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoSelect}
                  disabled={!editing || saving || conflict}
                  hidden
                />

                <button
                  type="button"
                  className="shop-logo-choose"
                  disabled={!editing || saving || conflict}
                  onClick={() =>
                    logoInputRef.current?.click()
                  }
                >
                  <Upload size={16} />

                  {logoPath
                    ? "Choose New Logo"
                    : "Choose Image"}
                </button>

                {(logoPath || selectedLogo) &&
                  !removeLogoRequested && (
                    <button
                      type="button"
                      className="shop-logo-remove"
                      onClick={handleLogoRemove}
                      disabled={!editing || saving || conflict}
                    >
                      <Trash2 size={16} />
                      Remove Logo
                    </button>
                  )}

                {(selectedLogo || removeLogoRequested) && (
                  <button
                    type="button"
                    className="shop-logo-undo"
                    onClick={handleLogoUndo}
                    disabled={!editing || saving}
                  >
                    <RefreshCw size={16} />
                    Undo
                  </button>
                )}

                <small>
                  PNG, JPG, JPEG, WEBP
                </small>

                <small>
                  Maximum file size: 10 MB
                </small>

                {selectedLogo && (
                  <div className="shop-logo-file-info">
                    <strong>{selectedLogo.name}</strong>

                    <span>
                      {(selectedLogo.size / 1024).toFixed(1)} KB
                    </span>

                    <span>Not saved yet</span>
                  </div>
                )}

                {removeLogoRequested && (
                  <small className="shop-logo-pending">
                    Logo will be removed when you save changes.
                  </small>
                )}
              </div>
            </div>

            {logoError && (
              <div
                className="shop-settings-error"
                role="alert"
              >
                {logoError}
              </div>
            )}
          </div>
        </div>

        <div className="shop-settings-actions">
          {!editing ? (
            <button
              type="button"
              className="shop-settings-primary"
              onClick={handleEdit}
              disabled={conflict}
            >
              <Pencil size={17} />
              Edit Settings
            </button>
          ) : (
            <>
              <button
                type="submit"
                className="shop-settings-primary"
                disabled={saving || conflict}
              >
                <Save size={17} />
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="shop-settings-secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                <X size={17} />
                Cancel
              </button>
            </>
          )}

          <button
            type="button"
            className="shop-settings-secondary"
            onClick={handleReload}
            disabled={saving}
          >
            <RefreshCw size={17} />
            Reload Settings
          </button>
        </div>

        {error && (
          <div
            className="shop-settings-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="shop-settings-success"
            role="status"
          >
            {success}
          </div>
        )}
      </form>
    </div>
  );
}
