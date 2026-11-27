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

const RED = "790E24";
const GOLD = "F4C430";
const WHITE = "FFFFFF";

function styleHeader(row) {
  row.height = 25;

  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: `FF${WHITE}` },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${RED}` },
    };

    cell.alignment = {
      vertical: "middle",
      wrapText: true,
    };
  });
}

function setCellValue(cell, value, type) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    cell.value = null;
    return;
  }

  if (
    type === "money" ||
    type === "weight" ||
    type === "number"
  ) {
    const text = String(value);

    const valid =
      type === "money"
        ? /^-?\d+(\.\d{1,2})?$/.test(text)
        : type === "weight"
          ? /^\d+(\.\d{1,3})?$/.test(text)
          : typeof value === "number" &&
            Number.isFinite(value);

    if (!valid) {
      cell.value = null;
      return;
    }

    const numericValue = Number(value);

    const scale =
      type === "money"
        ? 100
        : type === "weight"
          ? 1000
          : 1;

    if (
      !Number.isFinite(numericValue) ||
      Math.abs(numericValue * scale) >= 1e15
    ) {
      cell.value = text;
      return;
    }

    cell.value = numericValue;

    cell.numFmt =
      type === "money"
        ? '"LKR " #,##0.00;[Red]-"LKR " #,##0.00'
        : type === "weight"
          ? '#,##0.000" g"'
          : "#,##0";

    cell.alignment = {
      horizontal: "right",
    };

    return;
  }

  // Store text as text, never as an Excel formula.
  cell.value = formatReportValue(value, type);

  cell.alignment = {
    vertical: "top",
    wrapText: true,
  };
}

function addSummaryFields(sheet, fields, values) {
  for (const field of fields) {
    const row = sheet.addRow([field.label]);

    setCellValue(
      row.getCell(2),
      getFieldValue(values, field.key),
      field.type
    );
  }
}

function addDataSheet(workbook, name, columns, records) {
  const sheet = workbook.addWorksheet(name, {
    views: [
      {
        state: "frozen",
        ySplit: 1,
      },
    ],
  });

  sheet.columns = columns.map((column) => ({
    header: column.label,
    width:
      column.type === "money" ||
      column.type === "weight"
        ? 24
        : 25,
  }));

  styleHeader(sheet.getRow(1));

  for (const record of records) {
    const row = sheet.addRow([]);

    columns.forEach((column, index) => {
      setCellValue(
        row.getCell(index + 1),
        getFieldValue(record, column.key),
        column.type
      );
    });

    if (row.number % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF8E6" },
        };
      });
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: {
      row: Math.max(sheet.rowCount, 1),
      column: columns.length,
    },
  };

  return sheet;
}

export async function exportReportToExcel({
  report,
  filters,
  data,
  settings,
}) {
  const module = await import("exceljs");

  const ExcelJS = module.default ?? module;

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Gold Pawning System";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");

  summary.columns = [
    { width: 43 },
    { width: 65 },
  ];

  summary.mergeCells("A1:B1");

  summary.getCell("A1").value =
    settings.shop.name || "Gold Pawning System";

  summary.getCell("A1").font = {
    bold: true,
    size: 17,
    color: { argb: `FF${RED}` },
  };

  summary.getRow(1).height = 32;

  summary.mergeCells("A2:B2");
  summary.getCell("A2").value = report.title;

  summary.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${GOLD}` },
  };

  summary.getCell("A2").font = {
    bold: true,
    size: 14,
  };

  if (settings.shop.address) {
    summary.addRow([
      "Shop Address",
      settings.shop.address,
    ]);
  }

  if (settings.shop.contactNumber) {
    summary.addRow([
      "Contact Number",
      settings.shop.contactNumber,
    ]);
  }

  summary.addRow([
    "Calculated At",
    formatDate(data.calculationDate, true),
  ]);

  summary.addRow(["Time Zone", "Asia/Colombo"]);

  summary.addRow([
    "Total Exported Records",
    data.records.length,
  ]);

  summary.addRow([]);

  styleHeader(
    summary.addRow(["Applied Filters", "Value"])
  );

  for (const row of getExportFilterRows(
    report,
    filters
  )) {
    summary.addRow(row);
  }

  summary.addRow([]);

  styleHeader(
    summary.addRow(["Summary", "Value"])
  );

  addSummaryFields(
    summary,
    report.summary,
    data.summary
  );

  if (report.currentPosition && data.currentPosition) {
    summary.addRow([]);

    styleHeader(
      summary.addRow([
        "Current Financial Position",
        "Value",
      ])
    );

    addSummaryFields(
      summary,
      report.currentPosition,
      data.currentPosition
    );

    summary.addRow([
      "Balance Date Basis",
      "Current snapshot, not historical period end.",
    ]);
  }

  summary.addRow([]);

  styleHeader(
    summary.addRow(["Important Notes", ""])
  );

  summary.addRow([
    "Read-only Report",
    "Principal received is not profit.",
  ]);

  summary.addRow([
    "Outstanding Principal",
    "Excludes accrued interest and penalties.",
  ]);

  for (const warning of getExportWarnings(data)) {
    const row = summary.addRow([
      "Data Quality Warning",
      warning,
    ]);

    row.font = {
      color: { argb: "FFB91C1C" },
    };
  }

  summary.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        ...cell.alignment,
        vertical: "middle",
        wrapText: true,
      };
    });
  });

  addDataSheet(
    workbook,
    "Report Details",
    report.columns,
    data.records
  );

  if (
    report.id === "gold-inventory" &&
    Array.isArray(data.summary.karatBreakdown)
  ) {
    addDataSheet(
      workbook,
      "Karat Breakdown",
      [
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
          label: "Deduction Weight",
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
      ],
      data.summary.karatBreakdown
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download =
    `${report.id}-${getSriLankaToday()}.xlsx`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}