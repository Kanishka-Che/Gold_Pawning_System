
import {
  getFieldValue,
  formatReportValue,
  formatDate,
  getSriLankaToday,
} from "./reportFormatters";

import {
  getExportFilterRows,
  getExportWarnings,
} from "./reportExportData";

const RED = [121, 14, 36];
const GOLD = [244, 196, 48];
const WHITE = [255, 255, 255];
const BLACK = [23, 23, 23];

const MARGIN = 10;
const TOP_MARGIN = 28;
const BOTTOM_MARGIN = 17;

const KARAT_COLUMNS = [
  { key: "karat", label: "Karat" },
  {
    key: "itemCount",
    label: "Items",
    type: "number",
  },
  {
    key: "totalGrossWeight",
    label: "Gross Weight",
    type: "weight",
  },
  {
    key: "totalDeductionWeight",
    label: "Deduction",
    type: "weight",
  },
  {
    key: "totalNetWeight",
    label: "Net Weight",
    type: "weight",
  },
  {
    key: "invalidWeightCount",
    label: "Invalid Weights",
    type: "number",
  },
];

function pdfText(value) {
  const text = String(value ?? "-")
    .replaceAll("—", "-")
    .replaceAll("–", "-");

  // Standard PDF fonts do not support Sinhala.
  // Prevent silently exporting corrupted text.
  if (/[^\x20-\x7E\r\n\t]/.test(text)) {
    throw new Error(
      "This report contains unsupported characters. Unicode PDF font support is required."
    );
  }

  return text;
}

function formatValue(value, type) {
  return pdfText(formatReportValue(value, type));
}

function getSummaryRows(fields, values) {
  return fields.map((field) => [
    pdfText(field.label),
    formatValue(
      getFieldValue(values, field.key),
      field.type
    ),
  ]);
}

export async function createReportPdf({
  report,
  filters,
  data,
  settings,
  logo = null,
  orientation = "landscape",
}) {
  const { jsPDF } = await import("jspdf");

  const { autoTable } = await import(
    "jspdf-autotable"
  );

  const doc = new jsPDF({
    orientation:
      orientation === "portrait"
        ? "portrait"
        : "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const shop = settings.shop ?? {};

  const shopName = pdfText(
    shop.name || "Gold Pawning System"
  );

  const title = pdfText(report.title);

  const summary =
    data.periodSummary ?? data.summary ?? {};

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const contentWidth = pageWidth - MARGIN * 2;

  doc.setProperties({
    title: `${shopName} - ${title}`,
    subject: "Gold Pawning Report",
    author: shopName,
    creator: "Gold Pawning System",
  });

  let y = TOP_MARGIN;

  function ensureSpace(height = 20) {
    if (
      y + height >
      pageHeight - BOTTOM_MARGIN
    ) {
      doc.addPage();
      y = TOP_MARGIN;
    }
  }

  function addHeading(text) {
    ensureSpace(25);

    doc.setFillColor(...RED);

    doc.rect(
      MARGIN,
      y,
      contentWidth,
      8,
      "F"
    );

    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text(
      pdfText(text),
      MARGIN + 3,
      y + 5.5
    );

    y += 10;
  }

  function addParagraph(text, warning = false) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const lines = doc.splitTextToSize(
      pdfText(text),
      contentWidth - 4
    );

    for (const line of lines) {
      ensureSpace(5);

      doc.setTextColor(
        ...(warning ? RED : BLACK)
      );

      doc.text(line, MARGIN + 2, y + 3);

      y += 4.5;
    }

    y += 2;
  }

  function addTable(headers, rows, options = {}) {
    ensureSpace(20);

    autoTable(doc, {
      startY: y,

      margin: {
        top: TOP_MARGIN,
        bottom: BOTTOM_MARGIN,
        left: MARGIN,
        right: MARGIN,
      },

      head: [headers.map(pdfText)],

      body: rows.map((row) =>
        row.map(pdfText)
      ),

      theme: "grid",

      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "middle",
        textColor: BLACK,
        lineColor: [220, 220, 220],
        lineWidth: 0.15,
      },

      headStyles: {
        fillColor: RED,
        textColor: WHITE,
        fontStyle: "bold",
      },

      alternateRowStyles: {
        fillColor: [255, 248, 230],
      },

      showHead: "everyPage",
      rowPageBreak: "avoid",

      ...options,
    });

    y = doc.lastAutoTable.finalY + 7;
  }

  // Shop information

  if (shop.address) {
    addParagraph(`Address: ${shop.address}`);
  }

  if (shop.contactNumber) {
    addParagraph(
      `Contact: ${shop.contactNumber}`
    );
  }

  addParagraph(
    `Calculated At: ${formatDate(
      data.calculationDate,
      true
    )} (Sri Lanka Time)`
  );

  addParagraph(
    `Total Exported Records: ${data.records.length}`
  );

  // Applied filters

  const filterRows = getExportFilterRows(
    report,
    filters
  );

  addHeading("Applied Filters");

  addTable(
    ["Filter", "Value"],
    filterRows.length
      ? filterRows
      : [["Filters", "None"]]
  );

  // Report summary

  addHeading(
    report.id === "financial-summary"
      ? "Selected Period Summary"
      : "Report Summary"
  );

  addTable(
    ["Description", "Value"],
    getSummaryRows(
      report.summary,
      summary
    ),
    {
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65 },
        1: { halign: "right" },
      },
    }
  );

  // Current financial position

  if (
    report.currentPosition &&
    data.currentPosition
  ) {
    addHeading("Current Financial Position");

    addTable(
      ["Description", "Value"],
      getSummaryRows(
        report.currentPosition,
        data.currentPosition
      )
    );

    addParagraph(
      "Current snapshot, not historical period end."
    );
  }

  // Gold inventory breakdown

  if (
    report.id === "gold-inventory" &&
    Array.isArray(summary.karatBreakdown)
  ) {
    addHeading("Gold Weight by Karat");

    addTable(
      KARAT_COLUMNS.map((column) =>
        column.label
      ),
      summary.karatBreakdown.map((record) =>
        KARAT_COLUMNS.map((column) =>
          formatValue(
            getFieldValue(record, column.key),
            column.type
          )
        )
      )
    );
  }

  // Notes and data quality warnings

  addHeading("Important Notes");

  addParagraph(
    "Read-only report. Principal received is not profit."
  );

  addParagraph(
    "Outstanding principal excludes accrued interest and penalties."
  );

  for (const warning of getExportWarnings(data)) {
    addParagraph(
      `Data Quality Warning: ${warning}`,
      true
    );
  }

  // Full report details

  doc.addPage();
  y = TOP_MARGIN;

  addHeading("Report Details");

  addParagraph(
    `Total Records: ${data.records.length}`
  );

  if (data.records.length === 0) {
    addParagraph(
      "No records found for the selected filters."
    );
  } else {
    const columns = report.columns;

    const columnStyles = {};

    columns.forEach((column, index) => {
      columnStyles[index] = {
        halign: [
          "money",
          "weight",
          "number",
        ].includes(column.type)
          ? "right"
          : "left",
        minCellWidth: 20,
      };
    });

    addTable(
      columns.map((column) => column.label),

      data.records.map((record) =>
        columns.map((column) =>
          formatValue(
            getFieldValue(record, column.key),
            column.type
          )
        )
      ),

      {
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 1.8,
          overflow: "linebreak",
          valign: "middle",
        },

        columnStyles,

        horizontalPageBreak: true,

        horizontalPageBreakRepeat: 0,
      }
    );
  }

  // Repeated page headers and footers

  const totalPages =
    doc.getNumberOfPages();

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    doc.setPage(page);

    doc.setFillColor(...RED);

    doc.rect(
      0,
      0,
      pageWidth,
      23,
      "F"
    );

    let textX = MARGIN;

    if (logo) {
      const image = doc.getImageProperties(logo);

      const scale = Math.min(
        16 / image.width,
        16 / image.height
      );

      const width = image.width * scale;
      const height = image.height * scale;

      doc.addImage(
        logo,
        "PNG",
        MARGIN,
        (23 - height) / 2,
        width,
        height
      );

      textX += 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.setFontSize(14);

    const availableWidth =
      pageWidth - textX - MARGIN;

    doc.text(
      shopName,
      textX,
      9,
      {
        maxWidth: availableWidth,
      }
    );

    doc.setFontSize(10);

    doc.text(
      title,
      textX,
      18
    );

    doc.setFillColor(...GOLD);

    doc.rect(
      0,
      23,
      pageWidth,
      1.5,
      "F"
    );

    doc.setDrawColor(...GOLD);

    doc.line(
      MARGIN,
      pageHeight - 13,
      pageWidth - MARGIN,
      pageHeight - 13
    );

    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.text(
      "Confidential - Internal Business Report",
      MARGIN,
      pageHeight - 8
    );

    doc.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - MARGIN,
      pageHeight - 8,
      { align: "right" }
    );
  }

  return {
    blob: doc.output("blob"),

    filename:
      `${report.id}-${getSriLankaToday()}.pdf`,

    pageCount: totalPages,
  };
}

export function downloadReportPdf(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
