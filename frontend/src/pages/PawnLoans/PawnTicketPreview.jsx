
import {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../../../utils/api.js";
import {
  getPrintConfiguration,
  isPrintContentOverflowing,
} from "../../../utils/printConfiguration.js";

import "./PawnTicketPreview.scss";

const formatAmount = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "—";
  }

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString("en-GB", {
        timeZone: "Asia/Colombo",
      })
    : "—";

// const getPrintConfiguration = (settings) => {
//   const printing = settings?.printing ?? {};

//   const paperSize =
//     printing.paperSize === "A5" ? "A5" : "A4";

//   const orientation =
//     printing.orientation === "landscape"
//       ? "landscape"
//       : "portrait";

//   const layout =
//     paperSize === "A4" &&
//     printing.layout !== "full_page"
//       ? "half_page"
//       : "full_page";

//   const isHalfPage = layout === "half_page";

//   const ticketPosition =
//     isHalfPage &&
//     printing.ticketPosition === "bottom"
//       ? "bottom"
//       : "top";

//   const marginMm =
//     Number.isInteger(printing.marginMm) &&
//     printing.marginMm >= 5 &&
//     printing.marginMm <= 15
//       ? printing.marginMm
//       : 5;

//   const fontSizePt =
//     Number.isInteger(printing.fontSizePt) &&
//     printing.fontSizePt >= 9 &&
//     printing.fontSizePt <= 14
//       ? printing.fontSizePt
//       : 9;

//   const copies =
//     Number.isInteger(printing.copies) &&
//     printing.copies >= 1 &&
//     printing.copies <= 3
//       ? printing.copies
//       : 1;

//   const showCuttingLine =
//     isHalfPage &&
//     printing.showCuttingLine === true;

//   const baseWidth = paperSize === "A4" ? 210 : 148;
//   const baseHeight = paperSize === "A4" ? 297 : 210;

//   const paperWidth =
//     orientation === "portrait"
//       ? baseWidth
//       : baseHeight;

//   const paperHeight =
//     orientation === "portrait"
//       ? baseHeight
//       : baseWidth;

//   const ticketWidth =
//     paperWidth - marginMm * 2;

//   const ticketHeight =
//     (isHalfPage ? paperHeight / 2 : paperHeight) -
//     marginMm * 2;

//   const ticketTop =
//     isHalfPage && ticketPosition === "bottom"
//       ? paperHeight / 2 + marginMm
//       : marginMm;

//   return {
//     paperSize,
//     orientation,
//     layout,
//     ticketPosition,
//     marginMm,
//     fontSizePt,
//     copies,
//     showCuttingLine,
//     paperWidth,
//     paperHeight,
//     ticketWidth,
//     ticketHeight,
//     ticketTop,
//   };
// };


export default function PawnTicketPreview({
  loan,
  onClose,
}) {
  const [settings, setSettings] = useState(null);
  const [logoSrc, setLogoSrc] = useState("");
  const [logoReady, setLogoReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Load shop and printing settings
  useEffect(() => {
    const controller = new AbortController();

    let objectUrl = "";

    async function loadPrintingSettings() {
      setLoading(true);
      setError("");
      setLogoError("");
      setSettings(null);
      setLogoSrc("");
      setLogoReady(false);

      try {
        const response = await apiFetch(
          "/api/system-settings/printing",
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

        const savedSettings = data.settings;

        setSettings(savedSettings);

        const logoPath =
          savedSettings.shop?.logoUrl;

        const shouldShowLogo =
          savedSettings.pawnTicket?.showLogo === true &&
          Boolean(logoPath);

        // Load authenticated shop logo
        if (shouldShowLogo) {
          try {
            const validLogoPath =
              /^\/api\/system-settings\/logos\/logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

            if (!validLogoPath.test(logoPath)) {
              throw new Error("Invalid shop logo path.");
            }

            const logoResponse = await apiFetch(
              logoPath,
              { signal: controller.signal }
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

    loadPrintingSettings();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reloadKey]);

  const ticketContentRef = useRef(null);

const [contentOverflow, setContentOverflow] =
  useState(true);

const printConfig =
  getPrintConfiguration(settings);

const printVariables = {
  "--pt-paper-width":
    `${printConfig.paperWidth}mm`,

  "--pt-paper-height":
    `${printConfig.paperHeight}mm`,

  "--pt-ticket-width":
    `${printConfig.ticketWidth}mm`,

  "--pt-ticket-height":
    `${printConfig.ticketHeight}mm`,

  "--pt-ticket-top":
    `${printConfig.ticketTop}mm`,

  "--pt-margin":
    `${printConfig.marginMm}mm`,

  "--pt-font-size":
    `${printConfig.fontSizePt}pt`,
};

useLayoutEffect(() => {
  const content = ticketContentRef.current;

  if (!content || loading || !settings) {
    setContentOverflow(true);
    return;
  }

const checkOverflow = () => {
  const availableHeight =
    printConfig.ticketHeight * (96 / 25.4);

  const availableWidth =
    printConfig.ticketWidth * (96 / 25.4);

  const actualHeight = Math.max(
    content.getBoundingClientRect().height,
    content.scrollHeight
  );

  const actualWidth = content.scrollWidth;

  console.table({
    availableHeight,
    actualHeight,
    availableWidth,
    actualWidth,
    remainingHeight:
      availableHeight - actualHeight,
  });

  setContentOverflow(
    actualHeight > availableHeight ||
    actualWidth > availableWidth + 1
  );
};

  checkOverflow();

  const observer = new ResizeObserver(
    checkOverflow
  );

  observer.observe(content);

  return () => observer.disconnect();

}, [
  loan,
  settings,
  loading,
  logoReady,
  logoSrc,
  printConfig.ticketHeight,
  printConfig.ticketWidth,
  printConfig.fontSizePt,
]);

  if (!loan) return null;

  const shop = settings?.shop;
  const ticket = settings?.pawnTicket;

  const showTicketTitle =
  ticket?.showTicketTitle !== false;

const showShopAddress =
  ticket?.showShopAddress !== false;

const showShopContact =
  ticket?.showShopContact !== false;

const showTermsAndConditions =
  ticket?.showTermsAndConditions !== false;

const showCustomerSignature =
  ticket?.showCustomerSignature !== false;

const showAuthorizedSignature =
  ticket?.showAuthorizedSignature !== false;

const showSignatureFooter =
  showCustomerSignature ||
  showAuthorizedSignature;

const logoPosition =
  ["left", "top", "right"].includes(ticket?.logoPosition)
    ? ticket.logoPosition
    : "left";

const logoSize =
  ["small", "medium", "large"].includes(ticket?.logoSize)
    ? ticket.logoSize
    : "medium";

  const showGoldItemCode =
    ticket?.showGoldItemCode !== false;

  const showCustomerContact =
    ticket?.showCustomerContact !== false;

  const interestRate =
    loan.settingsSnapshot?.interest?.rate ??
    loan.interestRate;

  const calculationMethod =
    loan.settingsSnapshot?.interest?.calculationMethod;

  const canPrint =
  loan.status === "active" &&
  !loading &&
  Boolean(settings) &&
  !error &&
  !logoError &&
  logoReady &&
  !contentOverflow;

const handlePrint = () => {
  if (!canPrint) return;

  if (
    isPrintContentOverflowing(
      ticketContentRef.current,
      printConfig
    )
  ) {
    setContentOverflow(true);
    return;
  }

  window.print();
};

  return createPortal(
    <div
  className={`pawn-ticket-overlay ${
    !canPrint ? "pawn-ticket-print-blocked" : ""
  }`}
  style={printVariables}
>
  {settings && !loading && !error && (
    <style>
      {`
        @page {
          size: ${printConfig.paperSize}
                ${printConfig.orientation};
          margin: 0;
        }
      `}
    </style>
  )}
      <div
        className="pawn-ticket-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Pawn Ticket Preview"
      >
        {/* Preview Actions */}
        <div className="pawn-ticket-toolbar">
          <h3>Pawn Ticket Preview</h3>

          <div className="pawn-ticket-toolbar-actions">
            <button
              type="button"
              onClick={() =>
                setReloadKey((previous) => previous + 1)
              }
              disabled={loading}
            >
              Reload Settings
            </button>

            <button
              type="button"
              className="pawn-ticket-print-btn"
              onClick={handlePrint}
              disabled={!canPrint}
            >
              Print Ticket
            </button>

            <button type="button" onClick={onClose}>
              Close Preview
            </button>
          </div>
        </div>

          {settings && !loading && !error && (
  <div className="pawn-ticket-print-summary">

    <strong>Printing Configuration</strong>

    <div className="pawn-ticket-print-summary-items">

      <span>{printConfig.paperSize}</span>

      <span>
        {printConfig.orientation === "portrait"
          ? "Portrait"
          : "Landscape"}
      </span>

      <span>
        {printConfig.layout === "half_page"
          ? "Half Page"
          : "Full Page"}
      </span>

      {printConfig.layout === "half_page" && (
        <span>
          {printConfig.ticketPosition === "top"
            ? "Top"
            : "Bottom"}
        </span>
      )}

      <span>{printConfig.marginMm} mm margin</span>

      <span>{printConfig.fontSizePt} pt</span>

      <span>
        {printConfig.copies}{" "}
        {printConfig.copies === 1
          ? "Copy"
          : "Copies"}
      </span>

      {printConfig.showCuttingLine && (
        <span>Cutting Line ON</span>
      )}

    </div>

  </div>
)}

{settings &&
  !loading &&
  !error &&
  !logoError &&
  logoReady &&
  contentOverflow && (
    <div
      className="pawn-ticket-error"
      role="alert"
    >
      <strong>Ticket content exceeds the paper layout.</strong>

      <p>
        Change the printing layout to Full Page,
        reduce the font size or margins, or adjust
        optional ticket content before printing.
      </p>
    </div>
)}    


        {loading && (
          <div
            className="pawn-ticket-message"
            role="status"
          >
            Loading shop and printing settings...
          </div>
        )}

        {error && (
          <div
            className="pawn-ticket-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {logoError && (
          <div
            className="pawn-ticket-error"
            role="alert"
          >
            {logoError} Please reload settings before
            printing.
          </div>
        )}

       {!loading && settings && !error && (
  <div className="pawn-ticket-pages">

    {Array.from(
      { length: printConfig.copies },
      (_, copyIndex) => (
        <div
          key={copyIndex}
          className={`pawn-ticket-sheet ${
            copyIndex > 0
              ? "pawn-ticket-extra-copy"
              : ""
          }`}
        >

          <div
            className="pawn-ticket-paper"
            ref={
              copyIndex === 0
                ? ticketContentRef
                : undefined
            }
          >

            {/* Dynamic Shop Information */}
           
<header className="pawn-ticket-header">
  <div
    className={`pawn-ticket-shop-brand logo-position-${logoPosition}`}
  >
    {logoSrc && !logoError && (
      <img
        className={`pawn-ticket-shop-logo logo-size-${logoSize}`}
        src={logoSrc}
        alt="Shop logo"
        onLoad={() => setLogoReady(true)}
        onError={() => {
          setLogoReady(false);
          setLogoError(
            "Shop logo could not be displayed."
          );
        }}
      />
    )}

    <div className="pawn-ticket-shop-details">
      <h1>{shop.name}</h1>

      {showShopAddress && shop.address && (
        <p className="pawn-ticket-shop-address">
          {shop.address}
        </p>
      )}

      {showShopContact && shop.contactNumber && (
        <p>Tel: {shop.contactNumber}</p>
      )}

      {showShopContact && shop.email && (
        <p>Email: {shop.email}</p>
      )}

      {shop.registrationNumber && (
        <p>
          Reg. No: {shop.registrationNumber}
        </p>
      )}
    </div>
  </div>

  {showTicketTitle && (
    <h2>{ticket.title || "PAWN TICKET"}</h2>
  )}
</header>


            {/* Ticket Status */}
            {loan.status !== "active" && (
              <div className="pawn-ticket-watermark">
                {loan.status === "draft"
                  ? "DRAFT - NOT ISSUED"
                  : `${String(
                      loan.status || "UNKNOWN"
                    ).toUpperCase()} - PREVIEW ONLY`}
              </div>
            )}

            {/* Loan Information */}
            <section className="pawn-ticket-loan-info">
              <div>
                <strong>Loan No:</strong>{" "}
                {loan.loanNumber || "—"}
              </div>

              <div>
                <strong>Issue Date:</strong>{" "}
                {formatDate(loan.issueDate)}
              </div>
            </section>

            {/* Customer Information */}
            <section className="pawn-ticket-customer">
              <h3>Customer Information</h3>

              <div className="pawn-ticket-customer-grid">
                <p>
                  <strong>Customer Name:</strong>{" "}
                  {loan.customer?.fullName || "—"}
                </p>

                <p>
                  <strong>Customer Code:</strong>{" "}
                  {loan.customer?.customerCode || "—"}
                </p>

                <p>
                  <strong>NIC Number:</strong>{" "}
                  {loan.customer?.nic || "—"}
                </p>

                {showCustomerContact && (
                  <>
                    <p>
                      <strong>Contact Number:</strong>{" "}
                      {loan.customer?.phone || "—"}
                    </p>

                    <p className="pawn-ticket-customer-address">
                      <strong>Address:</strong>{" "}
                      {loan.customer?.address || "—"}
                    </p>
                  </>
                )}
              </div>
            </section>

            {/* Gold Item Information */}
            <section className="pawn-ticket-gold-items">
              <h3>Gold Item Details</h3>

              <table>
                <thead>
                  <tr>
                    {showGoldItemCode && (
                      <th>Item Code</th>
                    )}

                    <th>Item Type</th>
                    <th>Karat</th>
                    <th>Gross (g)</th>
                    <th>Deduction (g)</th>
                    <th>Net (g)</th>
                  </tr>
                </thead>

                <tbody>
                  {loan.goldItems?.length ? (
                    loan.goldItems.map((item, index) => (
                      <tr key={item._id || index}>
                        {showGoldItemCode && (
                          <td>
                            {item.goldItemCode ||
                              "Code Pending"}
                          </td>
                        )}

                        <td>{item.itemType || "—"}</td>
                        <td>{item.karat || "—"}</td>
                        <td>{item.grossWeight ?? "—"}</td>
                        <td>
                          {item.deductionWeight ?? "—"}
                        </td>
                        <td>{item.netWeight ?? "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={showGoldItemCode ? 6 : 5}
                      >
                        No gold items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Financial Information */}
            <section className="pawn-ticket-financial">
              <div className="pawn-ticket-amount">
                <span>Loan Amount</span>

                <strong>
                  {formatAmount(loan.principalAmount)}
                </strong>
              </div>

              <div className="pawn-ticket-financial-grid">
                <p>
                  <strong>Monthly Interest Rate:</strong>{" "}
                  {interestRate != null
                    ? `${interestRate}%`
                    : "—"}
                </p>

                <p>
                  <strong>Calculation Method:</strong>{" "}
                  {calculationMethod === "daily"
                    ? "Daily"
                    : calculationMethod === "monthly"
                    ? "Monthly"
                    : "—"}
                </p>

                <p>
                  <strong>Maturity Date:</strong>{" "}
                  {formatDate(loan.maturityDate)}
                </p>
              </div>
            </section>

           
{/* Terms and Conditions */}
{showTermsAndConditions &&
  ticket.termsAndConditions?.trim() && (
    <section className="pawn-ticket-terms">
      <h3>Terms & Conditions</h3>

      <p>{ticket.termsAndConditions}</p>
    </section>
  )}


           
{/* Signatures */}
{showSignatureFooter && (
  <footer
    className={`pawn-ticket-signatures ${
      showCustomerSignature &&
      showAuthorizedSignature
        ? "signature-both"
        : showCustomerSignature
        ? "signature-customer-only"
        : "signature-authorized-only"
    }`}
  >
    {showCustomerSignature && (
      <div>
        <span>
          {ticket.customerSignatureLabel ||
            "Customer Signature"}
        </span>
      </div>
    )}

    {showAuthorizedSignature && (
      <div>
        <span>
          {ticket.authorizedSignatureLabel ||
            "Authorized Signature"}
        </span>
      </div>
    )}
  </footer>
)}
 
          </div>

          {printConfig.showCuttingLine && (
            <div
              className="pawn-ticket-cutting-line"
              aria-hidden="true"
            />
          )}

        </div>
      )
    )}

  </div>
)}
      </div>
    </div>,
    document.body
  );
}
