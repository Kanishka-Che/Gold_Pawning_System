
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FileSpreadsheet,
  FileDown,
  Printer,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import {
  loadReportExportData,
  loadReportShopSettings,
  loadReportLogo,
} from "./reportExportData";

import {
  createReportPdf,
  downloadReportPdf,
} from "./reportPdfExporter";

import ReportPrintPreview from "./ReportPrintPreview";

export default function ReportExportActions({
  disabled,
  exporting,
  onExcelExport,
  report,
  filters,
}) {
  const [orientation, setOrientation] =
    useState("landscape");

  const [pdfAction, setPdfAction] =
    useState("");

  const [pdfError, setPdfError] =
    useState("");

  const [preview, setPreview] =
    useState(null);

  const controllerRef = useRef(null);

  const requestKey = JSON.stringify({
    reportId: report?.id,
    filters,
  });

  useEffect(() => {
    setPdfError("");
    setPdfAction("");
    setPreview(null);

    return () => {
      controllerRef.current?.abort();
    };
  }, [requestKey]);

  const busy =
    exporting || Boolean(pdfAction);

  async function handlePdfAction(action) {
    if (
      disabled ||
      busy ||
      !report ||
      !filters
    ) {
      return;
    }

    controllerRef.current?.abort();

    const controller =
      new AbortController();

    controllerRef.current = controller;

    setPdfAction(action);
    setPdfError("");

    try {
      const [data, settings] =
        await Promise.all([
          loadReportExportData({
            report,
            filters,
            signal: controller.signal,
          }),

          loadReportShopSettings(
            controller.signal
          ),
        ]);

      const logo = await loadReportLogo(
        settings,
        controller.signal
      );

      if (controller.signal.aborted) {
        return;
      }

      const result = await createReportPdf({
        report,
        filters,
        data,
        settings,
        logo,
        orientation,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (action === "download") {
        downloadReportPdf(
          result.blob,
          result.filename
        );
      } else {
        setPreview(result);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPdfError(
          error.message ||
            "Unable to generate PDF report."
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setPdfAction("");
      }
    }
  }

  return (
    <>
      <div className="report-export-actions">
        <label className="report-orientation">
          <span>PDF Orientation</span>

          <select
            value={orientation}
            disabled={disabled || busy}
            onChange={(event) =>
              setOrientation(event.target.value)
            }
          >
            <option value="landscape">
              A4 Landscape
            </option>

            <option value="portrait">
              A4 Portrait
            </option>
          </select>
        </label>

        <button
          type="button"
          className="report-button excel"
          disabled={disabled || busy}
          onClick={onExcelExport}
        >
          {exporting ? (
            <LoaderCircle
              size={17}
              className="report-spin"
            />
          ) : (
            <FileSpreadsheet size={17} />
          )}

          {exporting
            ? "Exporting..."
            : "Export Excel"}
        </button>

        <button
          type="button"
          className="report-button pdf"
          disabled={disabled || busy}
          onClick={() =>
            handlePdfAction("download")
          }
        >
          {pdfAction === "download" ? (
            <LoaderCircle
              size={17}
              className="report-spin"
            />
          ) : (
            <FileDown size={17} />
          )}

          {pdfAction === "download"
            ? "Generating..."
            : "Download PDF"}
        </button>

        <button
          type="button"
          className="report-button print"
          disabled={disabled || busy}
          onClick={() =>
            handlePdfAction("preview")
          }
        >
          {pdfAction === "preview" ? (
            <LoaderCircle
              size={17}
              className="report-spin"
            />
          ) : (
            <Printer size={17} />
          )}

          {pdfAction === "preview"
            ? "Preparing..."
            : "Print Preview"}
        </button>
      </div>

      {pdfError && (
        <div
          className="report-error"
          role="alert"
        >
          <AlertCircle size={18} />
          {pdfError}
        </div>
      )}

      {preview && (
        <ReportPrintPreview
          document={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
