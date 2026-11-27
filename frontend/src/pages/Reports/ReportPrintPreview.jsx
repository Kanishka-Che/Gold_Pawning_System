
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  X,
  Printer,
  Download,
  FileText,
} from "lucide-react";

import {
  downloadReportPdf,
} from "./reportPdfExporter";

import "./ReportPrintPreview.scss";

export default function ReportPrintPreview({
  document,
  onClose,
}) {
  const dialogRef = useRef(null);

  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!document?.blob) return;

    const objectUrl = URL.createObjectURL(
      document.blob
    );

    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [document]);

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

  function openForPrinting() {
    if (!url) return;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (!document) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="report-print-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="report-preview-header">
        <div>
          <h2>
            <FileText size={23} />
            Report Print Preview
          </h2>

          <p>
            {document.filename}
            {" · "}
            {document.pageCount} pages
          </p>
        </div>

        <button
          type="button"
          className="report-preview-close"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X size={24} />
        </button>
      </header>

      <div className="report-preview-toolbar">
        <button
          type="button"
          className="preview-download-button"
          onClick={() =>
            downloadReportPdf(
              document.blob,
              document.filename
            )
          }
        >
          <Download size={17} />
          Download PDF
        </button>

        <button
          type="button"
          className="preview-print-button"
          disabled={!url}
          onClick={openForPrinting}
        >
          <Printer size={17} />
          Open for Printing
        </button>
      </div>

      <div className="report-preview-info">
        Use the PDF viewer's print button to
        select your printer and print the report.
      </div>

      <div className="report-preview-body">
        {url && (
          <iframe
            src={url}
            title="Report PDF Preview"
          />
        )}
      </div>
    </dialog>,

    window.document.body
  );
}
