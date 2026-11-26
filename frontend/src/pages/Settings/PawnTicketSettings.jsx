
import { useEffect, useState } from "react";
import {
  ReceiptText,
  Pencil,
  Save,
  X,
  RefreshCw,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";
import "./PawnTicketSettings.scss";


const getTicketForm = (settings) => ({
  title: settings?.pawnTicket?.title ?? "PAWN TICKET",

  showTicketTitle:
    settings?.pawnTicket?.showTicketTitle ?? true,

  language:
    settings?.pawnTicket?.language ?? "en",

  showLogo:
    settings?.pawnTicket?.showLogo ?? false,

  showShopAddress:
    settings?.pawnTicket?.showShopAddress ?? true,

  showShopContact:
    settings?.pawnTicket?.showShopContact ?? true,

  logoPosition:
    settings?.pawnTicket?.logoPosition ?? "left",

  logoSize:
    settings?.pawnTicket?.logoSize ?? "medium",

  showCustomerContact:
    settings?.pawnTicket?.showCustomerContact ?? true,

  showGoldItemCode:
    settings?.pawnTicket?.showGoldItemCode ?? true,

  showTermsAndConditions:
    settings?.pawnTicket?.showTermsAndConditions ?? true,

  termsAndConditions:
    settings?.pawnTicket?.termsAndConditions ?? "",

  showCustomerSignature:
    settings?.pawnTicket?.showCustomerSignature ?? true,

  customerSignatureLabel:
    settings?.pawnTicket?.customerSignatureLabel ??
    "Customer Signature",

  showAuthorizedSignature:
    settings?.pawnTicket?.showAuthorizedSignature ?? true,

  authorizedSignatureLabel:
    settings?.pawnTicket?.authorizedSignatureLabel ??
    "Authorized Signature",
});



const headerOptions = [
  {
    name: "showTicketTitle",
    label: "Show Ticket Title",
    description: "Display the additional pawn ticket title.",
  },
  {
    name: "showShopAddress",
    label: "Show Shop Address",
    description: "Display the shop address on the ticket.",
  },
  {
    name: "showShopContact",
    label: "Show Shop Contact Details",
    description: "Display shop telephone number and email.",
  },
];

const logoOptions = [
  {
    name: "showLogo",
    label: "Show Shop Logo",
    description: "Display the uploaded shop logo.",
  },
];

const contentOptions = [
  {
    name: "showCustomerContact",
    label: "Show Customer Contact Details",
    description: "Display customer phone number and address.",
  },
  {
    name: "showGoldItemCode",
    label: "Show Gold Item Code",
    description: "Display item codes in the gold items table.",
  },
  {
    name: "showTermsAndConditions",
    label: "Show Terms & Conditions",
    description: "Display the saved pawn ticket terms.",
  },
];

const signatureOptions = [
  {
    name: "showCustomerSignature",
    label: "Show Customer Signature",
    description: "Display the customer signature line.",
  },
  {
    name: "showAuthorizedSignature",
    label: "Show Authorized Signature",
    description: "Display the authorized officer signature line.",
  },
];


export default function PawnTicketSettings() {
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

  // Load existing settings
  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await apiFetch(
          "/api/system-settings",
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.settings
        ) {
          throw new Error(
            data.message ||
              "Failed to load pawn ticket settings."
          );
        }

        if (controller.signal.aborted) return;

        setSettings(data.settings);
        setConfigured(data.configured === true);
        setForm(getTicketForm(data.settings));
        setEditing(false);
        setConflict(false);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
          setSettings(null);
          setForm(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => controller.abort();
  }, [reloadKey]);

  const hasShopLogo = Boolean(
    settings?.shop?.logoUrl
  );

  const updateField = (field, value) => {
    if (!editing || saving || conflict) return;

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  // Enable edit mode
  const handleEdit = () => {
    if (saving || conflict) return;

    setEditing(true);
    setError("");
    setSuccess("");
  };

  // Cancel unsaved changes
  const handleCancel = () => {
    if (saving) return;

    setForm(getTicketForm(settings));
    setEditing(false);
    setSuccess("");

    setError(
      conflict
        ? "Settings have changed. Reload before editing."
        : ""
    );
  };

  // Reload latest settings
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

    setReloadKey((previous) => previous + 1);
  };

  // Save pawn ticket settings
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

    const pawnTicket = {
      ...form,
      title: form.title.trim(),
      termsAndConditions:
        form.termsAndConditions.trim(),
      customerSignatureLabel:
        form.customerSignatureLabel.trim(),
      authorizedSignatureLabel:
        form.authorizedSignatureLabel.trim(),
    };

    // Required fields
    if (!pawnTicket.title) {
      setError("Ticket title is required.");
      return;
    }

    if (!pawnTicket.customerSignatureLabel) {
      setError("Customer signature label is required.");
      return;
    }

    if (!pawnTicket.authorizedSignatureLabel) {
      setError("Authorized signature label is required.");
      return;
    }

    // Length validation
    if (pawnTicket.title.length > 100) {
      setError("Ticket title must not exceed 100 characters.");
      return;
    }

    if (pawnTicket.termsAndConditions.length > 5000) {
      setError(
        "Terms and conditions must not exceed 5000 characters."
      );
      return;
    }

    if (
      pawnTicket.customerSignatureLabel.length > 100 ||
      pawnTicket.authorizedSignatureLabel.length > 100
    ) {
      setError(
        "Signature labels must not exceed 100 characters."
      );
      return;
    }

    // Logo compatibility validation
    if (pawnTicket.showLogo && !hasShopLogo) {
      setError(
        "Upload a shop logo before enabling logo printing."
      );
      return;
    }


if (
  !["left", "top", "right"].includes(
    pawnTicket.logoPosition
  )
) {
  setError("Select a valid logo position.");
  return;
}

if (
  !["small", "medium", "large"].includes(
    pawnTicket.logoSize
  )
) {
  setError("Select a valid logo size.");
  return;
}


    // Check for changes
    const current = getTicketForm(settings);

    const hasChanges = Object.entries(pawnTicket).some(
      ([key, value]) => current[key] !== value
    );

    if (configured && !hasChanges) {
      setEditing(false);
      setSuccess("No changes to save.");
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch(
        "/api/system-settings",
        {
          method: "PUT",
          body: JSON.stringify({
            expectedVersion: settings.version,
            pawnTicket,
          }),
        }
      );

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
          data.message ||
            "Failed to save pawn ticket settings."
        );
      }

      setSettings(data.settings);
      setConfigured(data.configured === true);
      setForm(getTicketForm(data.settings));

      setEditing(false);
      setConflict(false);

      setSuccess(
        "Pawn ticket settings saved successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pawn-ticket-settings-page">
        <p role="status">
          Loading pawn ticket settings...
        </p>
      </div>
    );
  }

  if (!settings || !form) {
    return (
      <div className="pawn-ticket-settings-page">
        <div className="pts-error" role="alert">
          {error || "Pawn ticket settings could not be loaded."}
        </div>

        <button
          type="button"
          className="pts-secondary"
          onClick={handleReload}
        >
          <RefreshCw size={17} />
          Retry
        </button>
      </div>
    );
  }

  const fieldsDisabled =
    !editing || saving || conflict;

  return (
    <div className="pawn-ticket-settings-page">

      {/* Header */}
      <div className="pts-header">
        <div className="pts-heading">
          <ReceiptText size={26} />

          <div>
            <h2>Pawn Ticket Settings</h2>

            <p>
              Customize pawn ticket information and content.
            </p>
          </div>
        </div>

        <span className="pts-version">
          Version {settings.version}
        </span>
      </div>

      {!configured && (
        <div className="pts-notice">
          System settings have not been configured yet.
          Edit and save to complete the initial setup.
        </div>
      )}

      <form onSubmit={handleSave}>


{/* Header Settings */}
<div className="pts-section">
  <h3>Header Settings</h3>

  <div className="pts-options">
    {headerOptions.map((option) => (
      <TicketToggle
        key={option.name}
        option={option}
        checked={form[option.name]}
        disabled={fieldsDisabled}
        onChange={updateField}
      />
    ))}
  </div>

  <div className="pts-fields pts-spaced">

    <div className="pts-field">
      <label htmlFor="pts-title">
        Ticket Title *
      </label>

      <input
        id="pts-title"
        type="text"
        value={form.title}
        maxLength={100}
        required
        disabled={
          fieldsDisabled || !form.showTicketTitle
        }
        onChange={(event) =>
          updateField("title", event.target.value)
        }
      />

      <small>
        Disable Show Ticket Title to display
        only the shop name.
      </small>
    </div>

    <div className="pts-field">
      <label htmlFor="pts-language">
        Ticket Language
      </label>

      <select
        id="pts-language"
        value={form.language}
        disabled
      >
        <option value="en">English</option>
        <option value="si">Sinhala</option>
        <option value="both">
          English & Sinhala
        </option>
      </select>

      <small>
        Language switching will be available
        after translation integration.
      </small>
    </div>

  </div>
</div>

{/* Logo Settings */}
<div className="pts-section">
  <h3>Logo Settings</h3>

  <div className="pts-options">
    {logoOptions.map((option) => (
      <TicketToggle
        key={option.name}
        option={option}
        checked={form[option.name]}
        disabled={
          fieldsDisabled ||
          (!hasShopLogo && !form.showLogo)
        }
        onChange={updateField}
        warning={
          !hasShopLogo
            ? "Upload a logo in Shop Settings first."
            : ""
        }
      />
    ))}
  </div>

  <div className="pts-fields pts-spaced">

    <div className="pts-field">
      <label htmlFor="pts-logo-position">
        Logo Position
      </label>

      <select
        id="pts-logo-position"
        value={form.logoPosition}
        disabled={
          fieldsDisabled ||
          !form.showLogo ||
          !hasShopLogo
        }
        onChange={(event) =>
          updateField(
            "logoPosition",
            event.target.value
          )
        }
      >
        <option value="left">Left</option>
        <option value="top">Top</option>
        <option value="right">Right</option>
      </select>
    </div>

    <div className="pts-field">
      <label htmlFor="pts-logo-size">
        Logo Size
      </label>

      <select
        id="pts-logo-size"
        value={form.logoSize}
        disabled={
          fieldsDisabled ||
          !form.showLogo ||
          !hasShopLogo
        }
        onChange={(event) =>
          updateField(
            "logoSize",
            event.target.value
          )
        }
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </div>

  </div>
</div>

{/* Content Settings */}
<div className="pts-section">
  <h3>Content Settings</h3>

  <div className="pts-options">
    {contentOptions.map((option) => (
      <TicketToggle
        key={option.name}
        option={option}
        checked={form[option.name]}
        disabled={fieldsDisabled}
        onChange={updateField}
      />
    ))}
  </div>

  <div className="pts-field pts-spaced">
    <label htmlFor="pts-terms">
      Pawn Ticket Terms
    </label>

    <textarea
      id="pts-terms"
      rows={7}
      maxLength={5000}
      value={form.termsAndConditions}
      disabled={
        fieldsDisabled ||
        !form.showTermsAndConditions
      }
      placeholder="Enter pawn ticket terms and conditions..."
      onChange={(event) =>
        updateField(
          "termsAndConditions",
          event.target.value
        )
      }
    />

    <div className="pts-character-count">
      {form.termsAndConditions.length} / 5000
    </div>

    <small>
      Long terms may exceed the half-page print layout.
    </small>
  </div>
</div>

{/* Signature Settings */}
<div className="pts-section">
  <h3>Signature Settings</h3>

  <div className="pts-options">
    {signatureOptions.map((option) => (
      <TicketToggle
        key={option.name}
        option={option}
        checked={form[option.name]}
        disabled={fieldsDisabled}
        onChange={updateField}
      />
    ))}
  </div>

  <div className="pts-fields pts-spaced">

    <div className="pts-field">
      <label htmlFor="pts-customer-signature">
        Customer Signature Label *
      </label>

      <input
        id="pts-customer-signature"
        type="text"
        value={form.customerSignatureLabel}
        maxLength={100}
        required
        disabled={
          fieldsDisabled ||
          !form.showCustomerSignature
        }
        onChange={(event) =>
          updateField(
            "customerSignatureLabel",
            event.target.value
          )
        }
      />
    </div>

    <div className="pts-field">
      <label htmlFor="pts-authorized-signature">
        Authorized Signature Label *
      </label>

      <input
        id="pts-authorized-signature"
        type="text"
        value={form.authorizedSignatureLabel}
        maxLength={100}
        required
        disabled={
          fieldsDisabled ||
          !form.showAuthorizedSignature
        }
        onChange={(event) =>
          updateField(
            "authorizedSignatureLabel",
            event.target.value
          )
        }
      />
    </div>

  </div>

  <div className="pts-help-text">
    Hidden signature labels will remain saved.
    Enable the signature again to display its label.
  </div>
</div>




        {/* Actions */}
        <div className="pts-actions">
          {!editing ? (
            <button
              type="button"
              className="pts-primary"
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
                className="pts-primary"
                disabled={saving || conflict}
              >
                <Save size={17} />
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="pts-secondary"
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
            className="pts-secondary"
            onClick={handleReload}
            disabled={saving}
          >
            <RefreshCw size={17} />
            Reload Settings
          </button>
        </div>

        {error && (
          <div className="pts-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="pts-success" role="status">
            {success}
          </div>
        )}

      </form>
    </div>
  );
}



function TicketToggle({
  option,
  checked,
  disabled,
  onChange,
  warning,
}) {
  return (
    <label className="pts-option">
      <span className="pts-option-text">
        <strong>{option.label}</strong>

        <span>{option.description}</span>

        {warning && (
          <small className="pts-warning">
            {warning}
          </small>
        )}
      </span>

      <span className="pts-switch">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) =>
            onChange(option.name, event.target.checked)
          }
        />

        <span className="pts-switch-slider" />
      </span>
    </label>
  );
}
