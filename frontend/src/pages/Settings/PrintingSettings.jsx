
import { useEffect, useState } from "react";

import {
  Printer,
  Pencil,
  Save,
  X,
  RefreshCw,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";
import "./PrintingSettings.scss";

const getPrintingForm = (settings) => ({
  paperSize:
    settings?.printing?.paperSize ?? "A4",

  layout:
    settings?.printing?.layout ?? "half_page",

  orientation:
    settings?.printing?.orientation ?? "portrait",

  ticketPosition:
    settings?.printing?.ticketPosition ?? "top",

  marginMm:
    settings?.printing?.marginMm ?? 5,

  fontSizePt:
    settings?.printing?.fontSizePt ?? 9,

  copies:
    settings?.printing?.copies ?? 1,

  showCuttingLine:
    settings?.printing?.showCuttingLine ?? false,
});

function PaperLayoutPreview({ form }) {
  const isA4 = form.paperSize === "A4";
  const isPortrait = form.orientation === "portrait";
  const isHalfPage = form.layout === "half_page";

  const baseWidth = isA4 ? 210 : 148;
  const baseHeight = isA4 ? 297 : 210;

  const paperWidth = isPortrait
    ? baseWidth
    : baseHeight;

  const paperHeight = isPortrait
    ? baseHeight
    : baseWidth;

  const margin = form.marginMm;

  const ticketWidth =
    paperWidth - margin * 2;

  const ticketHeight =
    (isHalfPage ? paperHeight / 2 : paperHeight)
    - margin * 2;

  const ticketY =
    isHalfPage && form.ticketPosition === "bottom"
      ? paperHeight / 2 + margin
      : margin;

  return (
    <div className="prs-preview">

      <h3>Paper Layout Preview</h3>

      <div className="prs-preview-stage">

        <svg
          viewBox={`-5 -5 ${paperWidth + 10} ${paperHeight + 10}`}
          className="prs-paper-svg"
          role="img"
          aria-label="Printing paper layout preview"
        >
          {/* Paper */}
          <rect
            x="0"
            y="0"
            width={paperWidth}
            height={paperHeight}
            fill="#ffffff"
            stroke="#aaaaaa"
            strokeWidth="0.5"
          />

          {/* Ticket area */}
          <rect
            x={margin}
            y={ticketY}
            width={ticketWidth}
            height={ticketHeight}
            fill="#fff8e6"
            stroke="#d4a017"
            strokeWidth="0.7"
            strokeDasharray="3 2"
          />

          {/* Sample ticket content */}
          <svg
            x={margin + 3}
            y={ticketY + 3}
            width={ticketWidth - 6}
            height={ticketHeight - 6}
            overflow="hidden"
          >
            <text
              x={(ticketWidth - 6) / 2}
              y="8"
              textAnchor="middle"
              fontSize="5"
              fontWeight="bold"
              fill="#991b1b"
            >
              PAWN TICKET
            </text>

            {[0, 1, 2, 3, 4].map((index) => (
              <rect
                key={index}
                x="3"
                y={15 + index * form.fontSizePt * 0.7}
                width={
                  (ticketWidth - 12) *
                  (index % 2 === 0 ? 0.95 : 0.65)
                }
                height="1.8"
                fill="#bcbcbc"
              />
            ))}
          </svg>

          {/* Cutting line */}
          {isHalfPage && form.showCuttingLine && (
            <line
              x1={margin}
              y1={paperHeight / 2}
              x2={paperWidth - margin}
              y2={paperHeight / 2}
              stroke="#555555"
              strokeWidth="0.6"
              strokeDasharray="4 3"
            />
          )}
        </svg>

      </div>

      <div className="prs-preview-summary">
        <strong>
          {form.paperSize} ·{" "}
          {isPortrait ? "Portrait" : "Landscape"}
        </strong>

        <span>
          {paperWidth} × {paperHeight} mm
        </span>

        <span>
          {isHalfPage ? "Half Page" : "Full Page"}
          {isHalfPage
            ? ` · ${form.ticketPosition === "top" ? "Top" : "Bottom"}`
            : ""}
        </span>

        <span>
          {form.marginMm} mm margin ·{" "}
          {form.fontSizePt} pt font
        </span>

        <span>
          {form.copies}{" "}
          {form.copies === 1 ? "copy" : "copies"}
        </span>
      </div>

      <small className="prs-preview-note">
        This is a paper layout illustration.
        Actual ticket content may require more space.
      </small>

    </div>
  );
}

export default function PrintingSettings() {
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

  // Load printing settings
  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await apiFetch(
          "/api/system-settings",
          { signal: controller.signal }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.settings
        ) {
          throw new Error(
            data.message ||
            "Failed to load printing settings."
          );
        }

        if (controller.signal.aborted) return;

        setSettings(data.settings);
        setForm(getPrintingForm(data.settings));
        setConfigured(data.configured === true);

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

  // Update form fields
  const updateField = (field, value) => {
    if (!editing || saving || conflict) return;

    setForm((previous) => {
      const next = {
        ...previous,
        [field]: value,
      };

      // A5 only supports full-page layout
      if (next.paperSize === "A5") {
        next.layout = "full_page";
      }

      // Full-page compatibility
      if (next.layout === "full_page") {
        next.ticketPosition = "top";
        next.showCuttingLine = false;
      }

      return next;
    });

    setError("");
    setSuccess("");
  };

  // Enable editing
  const handleEdit = () => {
    if (saving || conflict) return;

    setEditing(true);
    setError("");
    setSuccess("");
  };

  // Cancel changes
  const handleCancel = () => {
    if (saving) return;

    setForm(getPrintingForm(settings));
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

  // Save printing settings
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

    const printing = { ...form };

    // Validate paper size
    if (!["A4", "A5"].includes(printing.paperSize)) {
      setError("Invalid paper size.");
      return;
    }

    // Validate layout
    if (
      !["half_page", "full_page"].includes(
        printing.layout
      )
    ) {
      setError("Invalid ticket layout.");
      return;
    }

    // Validate orientation
    if (
      !["portrait", "landscape"].includes(
        printing.orientation
      )
    ) {
      setError("Invalid paper orientation.");
      return;
    }

    // Validate position
    if (
      !["top", "bottom"].includes(
        printing.ticketPosition
      )
    ) {
      setError("Invalid ticket position.");
      return;
    }

    // Validate margins
    if (
      !Number.isInteger(printing.marginMm) ||
      printing.marginMm < 5 ||
      printing.marginMm > 15
    ) {
      setError("Margin must be between 5 and 15 mm.");
      return;
    }

    // Validate font size
    if (
      !Number.isInteger(printing.fontSizePt) ||
      printing.fontSizePt < 9 ||
      printing.fontSizePt > 14
    ) {
      setError("Font size must be between 9 and 14 pt.");
      return;
    }

    // Validate copies
    if (
      !Number.isInteger(printing.copies) ||
      printing.copies < 1 ||
      printing.copies > 3
    ) {
      setError("Number of copies must be between 1 and 3.");
      return;
    }

    if (typeof printing.showCuttingLine !== "boolean") {
      setError("Invalid cutting line setting.");
      return;
    }

    // Compatibility validation
    if (
      printing.paperSize === "A5" &&
      printing.layout === "half_page"
    ) {
      setError("A5 paper only supports full-page layout.");
      return;
    }

    if (
      printing.layout === "full_page" &&
      (
        printing.ticketPosition !== "top" ||
        printing.showCuttingLine
      )
    ) {
      setError(
        "Bottom position and cutting line require half-page layout."
      );
      return;
    }

    // Check for actual changes
    const current = getPrintingForm(settings);

    const hasChanges = Object.entries(printing).some(
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
            printing,
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
          "Failed to save printing settings."
        );
      }

      setSettings(data.settings);
      setForm(getPrintingForm(data.settings));
      setConfigured(data.configured === true);

      setEditing(false);
      setConflict(false);

      setSuccess(
        "Printing settings saved successfully."
      );

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="printing-settings-page">
        <p role="status">
          Loading printing settings...
        </p>
      </div>
    );
  }

  if (!settings || !form) {
    return (
      <div className="printing-settings-page">

        <div className="prs-error" role="alert">
          {error || "Printing settings could not be loaded."}
        </div>

        <button
          type="button"
          className="prs-secondary"
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

  const isFullPage =
    form.layout === "full_page";

  return (
    <div className="printing-settings-page">

      {/* Header */}
      <div className="prs-header">

        <div className="prs-heading">
          <Printer size={26} />

          <div>
            <h2>Printing Settings</h2>

            <p>
              Configure paper size, ticket layout
              and printing preferences.
            </p>
          </div>
        </div>

        <span className="prs-version">
          Version {settings.version}
        </span>

      </div>

      {!configured && (
        <div className="prs-notice">
          System settings have not been configured yet.
          Edit and save to complete the initial setup.
        </div>
      )}

      <form onSubmit={handleSave}>

        <div className="prs-main-grid">

          <div className="prs-controls">

            {/* Paper configuration */}
            <div className="prs-section">

              <h3>Paper Configuration</h3>

              <div className="prs-fields">

                <div className="prs-field">
                  <label htmlFor="prs-paper-size">
                    Paper Size
                  </label>

                  <select
                    id="prs-paper-size"
                    value={form.paperSize}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      updateField(
                        "paperSize",
                        event.target.value
                      )
                    }
                  >
                    <option value="A4">
                      A4 (210 × 297 mm)
                    </option>

                    <option value="A5">
                      A5 (148 × 210 mm)
                    </option>
                  </select>
                </div>

                <div className="prs-field">
                  <label htmlFor="prs-layout">
                    Ticket Layout
                  </label>

                  <select
                    id="prs-layout"
                    value={form.layout}
                    disabled={
                      fieldsDisabled ||
                      form.paperSize === "A5"
                    }
                    onChange={(event) =>
                      updateField(
                        "layout",
                        event.target.value
                      )
                    }
                  >
                    <option
                      value="half_page"
                      disabled={form.paperSize === "A5"}
                    >
                      Half Page
                    </option>

                    <option value="full_page">
                      Full Page
                    </option>
                  </select>

                  {form.paperSize === "A5" && (
                    <small>
                      A5 only supports full-page layout.
                    </small>
                  )}
                </div>

                <div className="prs-field">
                  <label htmlFor="prs-orientation">
                    Orientation
                  </label>

                  <select
                    id="prs-orientation"
                    value={form.orientation}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      updateField(
                        "orientation",
                        event.target.value
                      )
                    }
                  >
                    <option value="portrait">
                      Portrait
                    </option>

                    <option value="landscape">
                      Landscape
                    </option>
                  </select>
                </div>

                <div className="prs-field">
                  <label htmlFor="prs-position">
                    Ticket Position
                  </label>

                  <select
                    id="prs-position"
                    value={form.ticketPosition}
                    disabled={
                      fieldsDisabled || isFullPage
                    }
                    onChange={(event) =>
                      updateField(
                        "ticketPosition",
                        event.target.value
                      )
                    }
                  >
                    <option value="top">
                      Top
                    </option>

                    <option value="bottom">
                      Bottom
                    </option>
                  </select>

                  {isFullPage && (
                    <small>
                      Position applies to half-page tickets.
                    </small>
                  )}
                </div>

              </div>
            </div>

            {/* Print appearance */}
            <div className="prs-section">

              <h3>Print Appearance</h3>

              <div className="prs-fields">

                <div className="prs-field">
                  <label htmlFor="prs-margin">
                    Page Margin (mm)
                  </label>

                  <select
                    id="prs-margin"
                    value={form.marginMm}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      updateField(
                        "marginMm",
                        Number(event.target.value)
                      )
                    }
                  >
                    {Array.from(
                      { length: 11 },
                      (_, index) => index + 5
                    ).map((value) => (
                      <option key={value} value={value}>
                        {value} mm
                      </option>
                    ))}
                  </select>
                </div>

                <div className="prs-field">
                  <label htmlFor="prs-font">
                    Font Size (pt)
                  </label>

                  <select
                    id="prs-font"
                    value={form.fontSizePt}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      updateField(
                        "fontSizePt",
                        Number(event.target.value)
                      )
                    }
                  >
                    {Array.from(
                      { length: 6 },
                      (_, index) => index + 9
                    ).map((value) => (
                      <option key={value} value={value}>
                        {value} pt
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Additional printing options */}
            <div className="prs-section">

              <h3>Additional Options</h3>

              <div className="prs-field">
                <label htmlFor="prs-copies">
                  Number of Copies
                </label>

                <select
                  id="prs-copies"
                  value={form.copies}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    updateField(
                      "copies",
                      Number(event.target.value)
                    )
                  }
                >
                  <option value={1}>1 Copy</option>
                  <option value={2}>2 Copies</option>
                  <option value={3}>3 Copies</option>
                </select>
              </div>

              <label className="prs-option">

                <span className="prs-option-text">
                  <strong>Show Cutting Line</strong>

                  <span>
                    Display a cutting guide for
                    half-page tickets.
                  </span>

                  {isFullPage && (
                    <small>
                      Only available for half-page layout.
                    </small>
                  )}
                </span>

                <span className="prs-switch">

                  <input
                    type="checkbox"
                    role="switch"
                    checked={form.showCuttingLine}
                    disabled={
                      fieldsDisabled || isFullPage
                    }
                    onChange={(event) =>
                      updateField(
                        "showCuttingLine",
                        event.target.checked
                      )
                    }
                  />

                  <span className="prs-switch-slider" />

                </span>
              </label>

            </div>

          </div>

          {/* Live paper preview */}
          <PaperLayoutPreview form={form} />

        </div>

        <div className="prs-notice">
          Printing preferences are saved here.
          Actual printing integration and printer
          compatibility must be verified separately.
        </div>

        {/* Actions */}
        <div className="prs-actions">

          {!editing ? (
            <button
              type="button"
              className="prs-primary"
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
                className="prs-primary"
                disabled={saving || conflict}
              >
                <Save size={17} />

                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="prs-secondary"
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
            className="prs-secondary"
            onClick={handleReload}
            disabled={saving}
          >
            <RefreshCw size={17} />
            Reload Settings
          </button>

        </div>

        {error && (
          <div className="prs-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="prs-success" role="status">
            {success}
          </div>
        )}

      </form>
    </div>
  );
}
