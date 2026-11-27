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

import "./PaymentReceiptPreview.scss";

const formatAmount = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "-";
  }

  return new Date(value).toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatMethod = (method) => {
  if (method === "cash") return "Cash";

  if (method === "bank_transfer") {
    return "Bank Transfer";
  }

  return "Unknown";
};

const toCents = (value) => {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) {
    return null;
  }

  const cents = Math.round(Number(value) * 100);

  return Number.isSafeInteger(cents)
    ? cents
    : null;
};

const isValidPayment = (payment) => {
  if (!payment?._id) return false;

  const amount = toCents(payment.amount);
  const interest = toCents(payment.interestPaid);
  const principal = toCents(payment.principalPaid);

  return (
    amount !== null &&
    interest !== null &&
    principal !== null &&
    amount > 0 &&
    interest + principal === amount &&
    Boolean(payment.paidAt) &&
    !Number.isNaN(Date.parse(payment.paidAt)) &&
    ["cash", "bank_transfer"].includes(
      payment.paymentMethod
    )
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

export default function PaymentReceiptPreview({
  payment,
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

  // Open receipt preview as a native modal
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

  // Load shop and printing settings
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
    payment,
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

  const validPayment = isValidPayment(payment);

  const canPrint =
    validPayment &&
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

  if (!payment) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`payment-receipt-dialog ${
        !canPrint ? "pr-print-blocked" : ""
      }`}
      style={printVariables}
      aria-label="Payment Receipt Preview"
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
            <h2>Payment Receipt Preview</h2>

            <p>
              Print an existing recorded payment.
            </p>
          </div>
        </div>

        <div className="pr-actions">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setReloadKey((value) => value + 1);
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

            <span>{config.marginMm} mm margin</span>

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

      {!validPayment && (
        <div className="pr-error" role="alert">
          Invalid or incomplete payment record.
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

      {!loading && settings && !error && (
        <div className="pr-pages">
          {Array.from(
            { length: config.copies },
            (_, index) => (
              <div
                key={index}
                className={`pr-sheet ${
                  index > 0 ? "pr-extra-copy" : ""
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
                              Tel: {shop.contactNumber}
                            </p>
                          )}

                        {showShopContact &&
                          shop.email && (
                            <p>Email: {shop.email}</p>
                          )}

                        {shop.registrationNumber && (
                          <p>
                            Reg. No:{" "}
                            {shop.registrationNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    <h2>PAYMENT RECEIPT</h2>

                    <p className="pr-record-label">
                      Recorded Payment
                    </p>
                  </div>

                  <section className="pr-section">
                    <h3>Payment Information</h3>

                    <div className="pr-info-grid">
                      <ReceiptField
                        label="Payment ID"
                        value={payment._id}
                      />

                      <ReceiptField
                        label="Payment Date"
                        value={formatDate(
                          payment.paidAt
                        )}
                      />

                      <ReceiptField
                        label="Pawn Loan Number"
                        value={
                          payment.pawnLoan
                            ?.loanNumber ||
                          "Unavailable"
                        }
                      />

                      <ReceiptField
                        label="Customer Code"
                        value={
                          payment.pawnLoan
                            ?.customer?.customerCode ||
                          "Unavailable"
                        }
                      />

                      <ReceiptField
                        label="Customer Name"
                        value={
                          payment.pawnLoan
                            ?.customer?.fullName ||
                          "Unavailable"
                        }
                      />

                      <ReceiptField
                        label="Payment Method"
                        value={formatMethod(
                          payment.paymentMethod
                        )}
                      />

                      <ReceiptField
                        label="Recorded By"
                        value={
                          payment.recordedBy
                            ?.username ||
                          "Unavailable"
                        }
                      />

                      <ReceiptField
                        label="Reference"
                        value={
                          payment.reference || "-"
                        }
                      />
                    </div>
                  </section>

                  <section className="pr-section">
                    <h3>Payment Allocation</h3>

                    <div className="pr-amount-row">
                      <span>Interest Paid</span>

                      <strong>
                        {formatAmount(
                          payment.interestPaid
                        )}
                      </strong>
                    </div>

                    <div className="pr-amount-row">
                      <span>Principal Paid</span>

                      <strong>
                        {formatAmount(
                          payment.principalPaid
                        )}
                      </strong>
                    </div>

                    <div className="pr-total">
                      <span>Total Received</span>

                      <strong>
                        {formatAmount(payment.amount)}
                      </strong>
                    </div>
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
                      existing payment record.
                    </p>

                    <p>
                      Shop and customer details reflect
                      current records.
                    </p>

                    <p>
                      This receipt is not a gold
                      redemption authorization.
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