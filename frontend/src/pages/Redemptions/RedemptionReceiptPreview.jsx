
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  Printer,
  RefreshCw,
  X,
  ReceiptText,
} from "lucide-react";

import { apiFetch } from "../../../utils/api.js";

import {
  getPrintConfiguration,
  isPrintContentOverflowing,
} from "../../../utils/printConfiguration.js";

import {
  formatAmount,
  formatDateTime,
} from "./redemptionFormatters.js";

import "../Payments/PaymentReceiptPreview.scss";
import "./RedemptionReceiptPreview.scss";

const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

const isObjectId = (value) =>
  typeof value === "string" &&
  /^[a-fA-F0-9]{24}$/.test(value);

const toCents = (value) => {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return null;
  }

  const text = String(value);

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [whole, fraction = ""] = text.split(".");

  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  return cents <= MAX_CENTS ? cents : null;
};

const isValidRedemption = (redemption) => {
  if (
    !redemption ||
    !isObjectId(redemption._id) ||
    !redemption.redeemedAt ||
    Number.isNaN(Date.parse(redemption.redeemedAt))
  ) {
    return false;
  }

  const principal = toCents(
    redemption.principalSettled
  );

  const interest = toCents(
    redemption.interestSettled
  );

  const penalty = toCents(
    redemption.penaltySettled
  );

  const total = toCents(
    redemption.totalSettled
  );

  if (
    principal === null ||
    interest === null ||
    penalty === null ||
    total === null ||
    principal + interest + penalty !== total
  ) {
    return false;
  }

  if (
    !Number.isSafeInteger(
      redemption.settingsVersion
    ) ||
    redemption.settingsVersion < 1
  ) {
    return false;
  }

  if (
    !redemption.pawnLoan?.loanNumber ||
    !redemption.pawnLoan?.customer?.customerCode ||
    !redemption.pawnLoan?.customer?.fullName ||
    !redemption.redeemedBy?.username
  ) {
    return false;
  }

  const items = redemption.releasedGoldItems;

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return false;
  }

  const validItems = items.every(
    (item) =>
      isObjectId(item?._id) &&
      typeof item.itemType === "string" &&
      item.itemType.trim().length > 0 &&
      typeof item.karat === "string" &&
      item.karat.trim().length > 0 &&
      typeof item.netWeight === "number" &&
      Number.isFinite(item.netWeight) &&
      item.netWeight > 0
  );

  return (
    validItems &&
    new Set(items.map((item) => item._id)).size ===
      items.length
  );
};

function ReceiptField({ label, value }) {
  return (
    <div className="pr-field">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function RedemptionReceiptPreview({
  redemption,
  onClose,
}) {
  const dialogRef = useRef(null);
  const receiptRef = useRef(null);

  const [settings, setSettings] = useState(null);
  const [logoSrc, setLogoSrc] = useState("");
  const [logoReady, setLogoReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const [contentOverflow, setContentOverflow] =
    useState(true);

  // Open native receipt preview modal
  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  // Load shared printing settings
  useEffect(() => {
    const controller = new AbortController();

    let objectUrl = "";

    async function loadSettings() {
      setLoading(true);
      setError("");
      setLogoError("");
      setSettings(null);
      setLogoSrc("");
      setLogoReady(false);
      setContentOverflow(true);

      try {
        const response = await apiFetch(
          "/api/system-settings/printing",
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.settings?.shop ||
          !data.settings?.printing
        ) {
          throw new Error(
            data.message ||
              "Failed to load printing settings."
          );
        }

        if (controller.signal.aborted) return;

        const savedSettings = data.settings;

        setSettings(savedSettings);

        const logoPath =
          savedSettings.shop?.logoUrl;

        const shouldShowLogo =
          savedSettings.pawnTicket?.showLogo === true;

        if (shouldShowLogo) {
          try {
            const validLogoPath =
              /^\/api\/system-settings\/logos\/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

            if (
              typeof logoPath !== "string" ||
              !validLogoPath.test(logoPath)
            ) {
              throw new Error(
                "Invalid shop logo path."
              );
            }

            const logoResponse = await apiFetch(
              logoPath,
              {
                signal: controller.signal,
              }
            );

            if (!logoResponse.ok) {
              throw new Error(
                "Failed to load shop logo."
              );
            }

            const blob = await logoResponse.blob();

            if (blob.type !== "image/png") {
              throw new Error(
                "Invalid shop logo format."
              );
            }

            if (controller.signal.aborted) return;

            objectUrl = URL.createObjectURL(blob);

            setLogoSrc(objectUrl);
          } catch (err) {
            if (!controller.signal.aborted) {
              setLogoError(err.message);
            }
          }
        } else {
          setLogoReady(true);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
              "Failed to load printing settings."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reloadKey]);

  const config = getPrintConfiguration(settings);

  const printVariables = {
    "--pr-paper-width": `${config.paperWidth}mm`,
    "--pr-paper-height": `${config.paperHeight}mm`,
    "--pr-content-width": `${config.ticketWidth}mm`,
    "--pr-content-height": `${config.ticketHeight}mm`,
    "--pr-content-top": `${config.ticketTop}mm`,
    "--pr-margin": `${config.marginMm}mm`,
    "--pr-font-size": `${config.fontSizePt}pt`,
  };

  // Validate receipt dimensions
  useLayoutEffect(() => {
    const content = receiptRef.current;

    if (!content || loading || !settings) {
      setContentOverflow(true);
      return;
    }

    const checkOverflow = () => {
      setContentOverflow(
        isPrintContentOverflowing(content, config)
      );
    };

    checkOverflow();

    const observer = new ResizeObserver(
      checkOverflow
    );

    observer.observe(content);

    return () => observer.disconnect();
  }, [
    redemption,
    settings,
    loading,
    logoReady,
    logoSrc,
    config.ticketWidth,
    config.ticketHeight,
    config.fontSizePt,
  ]);

  const shop = settings?.shop ?? {};
  const ticket = settings?.pawnTicket ?? {};

  const goldItems = Array.isArray(
    redemption?.releasedGoldItems
  )
    ? redemption.releasedGoldItems
    : [];

  const showShopAddress =
    ticket.showShopAddress !== false;

  const showShopContact =
    ticket.showShopContact !== false;

  const showCustomerSignature =
    ticket.showCustomerSignature !== false;

  const showAuthorizedSignature =
    ticket.showAuthorizedSignature !== false;

  const logoPosition = [
    "left",
    "top",
    "right",
  ].includes(ticket.logoPosition)
    ? ticket.logoPosition
    : "left";

  const logoSize = [
    "small",
    "medium",
    "large",
  ].includes(ticket.logoSize)
    ? ticket.logoSize
    : "medium";

  const validRedemption =
    isValidRedemption(redemption);

  const canPrint =
    validRedemption &&
    !loading &&
    Boolean(settings) &&
    Boolean(shop.name?.trim()) &&
    !error &&
    !logoError &&
    logoReady &&
    !contentOverflow;

  const handlePrint = () => {
    if (!canPrint) return;

    if (
      isPrintContentOverflowing(
        receiptRef.current,
        config
      )
    ) {
      setContentOverflow(true);
      return;
    }

    window.print();
  };

  if (!redemption) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`payment-receipt-dialog redemption-receipt-dialog ${
        !canPrint ? "pr-print-blocked" : ""
      }`}
      style={printVariables}
      aria-label="Redemption Receipt Preview"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {settings && !loading && !error && (
        <style>
          {`
            @page {
              size: ${config.paperSize}
                    ${config.orientation};
              margin: 0;
            }
          `}
        </style>
      )}

      <div className="pr-toolbar">
        <div className="pr-heading">
          <ReceiptText size={24} />

          <div>
            <h2>Redemption Receipt Preview</h2>

            <p>
              Print an existing redemption record.
            </p>
          </div>
        </div>

        <div className="pr-actions">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setReloadKey(
                (previous) => previous + 1
              );
            }}
          >
            <RefreshCw size={16} />
            Reload Settings
          </button>

          <button
            type="button"
            className="pr-print-btn"
            disabled={!canPrint}
            onClick={handlePrint}
          >
            <Printer size={17} />
            Print Receipt
          </button>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={17} />
            Close Preview
          </button>
        </div>
      </div>

      {settings && !loading && !error && (
        <div className="pr-print-summary">
          <strong>Printing Configuration</strong>

          <div className="pr-summary-items">
            <span>{config.paperSize}</span>

            <span>
              {config.orientation === "portrait"
                ? "Portrait"
                : "Landscape"}
            </span>

            <span>
              {config.layout === "half_page"
                ? "Half Page"
                : "Full Page"}
            </span>

            {config.layout === "half_page" && (
              <span>
                {config.ticketPosition === "top"
                  ? "Top"
                  : "Bottom"}
              </span>
            )}

            <span>
              {config.marginMm} mm margin
            </span>

            <span>{config.fontSizePt} pt</span>

            <span>
              {config.copies}{" "}
              {config.copies === 1
                ? "Copy"
                : "Copies"}
            </span>

            {config.showCuttingLine && (
              <span>Cutting Line ON</span>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="pr-message" role="status">
          Loading shop and printing settings...
        </div>
      )}

      {error && (
        <div className="pr-error" role="alert">
          {error}
        </div>
      )}

      {logoError && (
        <div className="pr-error" role="alert">
          {logoError} Please reload settings.
        </div>
      )}

      {!validRedemption && (
        <div className="pr-error" role="alert">
          Invalid or incomplete redemption record.
          Receipt printing is disabled.
        </div>
      )}

      {settings &&
        !loading &&
        !shop.name?.trim() && (
          <div className="pr-error" role="alert">
            Shop name is missing.
          </div>
        )}

      {settings &&
        !loading &&
        !error &&
        !logoError &&
        logoReady &&
        contentOverflow && (
          <div className="pr-error" role="alert">
            <strong>
              Receipt content exceeds the paper layout.
            </strong>

            <p>
              Use Full Page printing or reduce the
              font size and margins.
            </p>
          </div>
        )}

      {!loading &&
        settings &&
        !error &&
        validRedemption && (
          <div className="pr-pages">
            {Array.from(
              { length: config.copies },
              (_, index) => (
                <div
                  key={index}
                  className={`pr-sheet ${
                    index > 0
                      ? "pr-extra-copy"
                      : ""
                  }`}
                >
                  <article
                    className="pr-paper"
                    ref={
                      index === 0
                        ? receiptRef
                        : undefined
                    }
                  >
                    <div className="pr-receipt-header">
                      <div
                        className={`pr-shop-brand logo-position-${logoPosition}`}
                      >
                        {logoSrc && !logoError && (
                          <img
                            src={logoSrc}
                            alt="Shop logo"
                            className={`pr-shop-logo logo-size-${logoSize}`}
                            onLoad={() =>
                              setLogoReady(true)
                            }
                            onError={() => {
                              setLogoReady(false);

                              setLogoError(
                                "Shop logo could not be displayed."
                              );
                            }}
                          />
                        )}

                        <div className="pr-shop-details">
                          <h1>{shop.name}</h1>

                          {showShopAddress &&
                            shop.address && (
                              <p className="pr-address">
                                {shop.address}
                              </p>
                            )}

                          {showShopContact &&
                            shop.contactNumber && (
                              <p>
                                Tel:{" "}
                                {shop.contactNumber}
                              </p>
                            )}

                          {showShopContact &&
                            shop.email && (
                              <p>
                                Email: {shop.email}
                              </p>
                            )}

                          {shop.registrationNumber && (
                            <p>
                              Reg. No:{" "}
                              {shop.registrationNumber}
                            </p>
                          )}
                        </div>
                      </div>

                      <h2>
                        GOLD REDEMPTION RECEIPT
                      </h2>

                      <p className="pr-record-label">
                        Recorded Redemption
                      </p>
                    </div>

                    <section className="pr-section">
                      <h3>
                        Redemption Information
                      </h3>

                      <div className="pr-info-grid">
                        <ReceiptField
                          label="Redemption ID"
                          value={redemption._id}
                        />

                        <ReceiptField
                          label="Redeemed Date"
                          value={formatDateTime(
                            redemption.redeemedAt
                          )}
                        />

                        <ReceiptField
                          label="Pawn Loan Number"
                          value={
                            redemption.pawnLoan
                              ?.loanNumber
                          }
                        />

                        <ReceiptField
                          label="Customer Code"
                          value={
                            redemption.pawnLoan
                              ?.customer?.customerCode
                          }
                        />

                        <ReceiptField
                          label="Customer Name"
                          value={
                            redemption.pawnLoan
                              ?.customer?.fullName
                          }
                        />

                        <ReceiptField
                          label="Recorded By"
                          value={
                            redemption.redeemedBy
                              ?.username
                          }
                        />

                        <ReceiptField
                          label="Settings Version"
                          value={
                            redemption.settingsVersion
                          }
                        />
                      </div>
                    </section>

                    <section className="pr-section">
                      <h3>Settlement Details</h3>

                      <div className="pr-amount-row">
                        <span>
                          Principal Settled
                        </span>

                        <strong>
                          {formatAmount(
                            redemption.principalSettled
                          )}
                        </strong>
                      </div>

                      <div className="pr-amount-row">
                        <span>
                          Interest Settled
                        </span>

                        <strong>
                          {formatAmount(
                            redemption.interestSettled
                          )}
                        </strong>
                      </div>

                      <div className="pr-amount-row">
                        <span>
                          Penalty Settled
                        </span>

                        <strong>
                          {formatAmount(
                            redemption.penaltySettled
                          )}
                        </strong>
                      </div>

                      <div className="pr-total">
                        <span>Total Settled</span>

                        <strong>
                          {formatAmount(
                            redemption.totalSettled
                          )}
                        </strong>
                      </div>
                    </section>

                    <section className="pr-section">
                      <h3>
                        Recorded Released Gold Items
                        ({goldItems.length})
                      </h3>

                      <table className="rr-gold-table">
                        <thead>
                          <tr>
                            <th>Item Code</th>
                            <th>Item Type</th>
                            <th>Karat</th>
                            <th>Net Weight</th>
                          </tr>
                        </thead>

                        <tbody>
                          {goldItems.map((item) => (
                            <tr key={item._id}>
                              <td>
                                {item.goldItemCode ||
                                  "Unavailable"}
                              </td>

                              <td>
                                {item.itemType}
                              </td>

                              <td>
                                {item.karat}
                              </td>

                              <td>
                                {item.netWeight.toFixed(
                                  3
                                )}{" "}
                                g
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>

                    {(showCustomerSignature ||
                      showAuthorizedSignature) && (
                      <div className="pr-signatures">
                        {showCustomerSignature && (
                          <div>
                            {ticket.customerSignatureLabel ||
                              "Customer Signature"}
                          </div>
                        )}

                        {showAuthorizedSignature && (
                          <div className="pr-authorized-signature">
                            {ticket.authorizedSignatureLabel ||
                              "Authorized Signature"}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pr-receipt-footer">
                      <p>
                        Receipt generated from an
                        existing redemption record.
                      </p>

                      <p>
                        Shop, customer, loan and gold
                        item details reflect current
                        database records.
                      </p>

                      <p>
                        Printing this receipt does not
                        authorize or perform a gold
                        release.
                      </p>

                      <strong>Thank you!</strong>
                    </div>
                  </article>

                  {config.showCuttingLine && (
                    <div
                      className="pr-cutting-line"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            )}
          </div>
        )}
    </dialog>,
    document.body
  );
}
