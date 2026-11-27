export function getPrintConfiguration(settings) {
  const printing = settings?.printing ?? {};

  const paperSize =
    printing.paperSize === "A5" ? "A5" : "A4";

  const orientation =
    printing.orientation === "landscape"
      ? "landscape"
      : "portrait";

  const layout =
    paperSize === "A4" &&
    printing.layout !== "full_page"
      ? "half_page"
      : "full_page";

  const isHalfPage = layout === "half_page";

  const ticketPosition =
    isHalfPage &&
    printing.ticketPosition === "bottom"
      ? "bottom"
      : "top";

  const marginMm =
    Number.isInteger(printing.marginMm) &&
    printing.marginMm >= 5 &&
    printing.marginMm <= 15
      ? printing.marginMm
      : 5;

  const fontSizePt =
    Number.isInteger(printing.fontSizePt) &&
    printing.fontSizePt >= 9 &&
    printing.fontSizePt <= 14
      ? printing.fontSizePt
      : 9;

  const copies =
    Number.isInteger(printing.copies) &&
    printing.copies >= 1 &&
    printing.copies <= 3
      ? printing.copies
      : 1;

  const showCuttingLine =
    isHalfPage &&
    printing.showCuttingLine === true;

  const baseWidth = paperSize === "A4" ? 210 : 148;
  const baseHeight = paperSize === "A4" ? 297 : 210;

  const paperWidth =
    orientation === "portrait"
      ? baseWidth
      : baseHeight;

  const paperHeight =
    orientation === "portrait"
      ? baseHeight
      : baseWidth;

  const ticketWidth = paperWidth - marginMm * 2;

  const ticketHeight =
    (isHalfPage ? paperHeight / 2 : paperHeight) -
    marginMm * 2;

  const ticketTop =
    isHalfPage && ticketPosition === "bottom"
      ? paperHeight / 2 + marginMm
      : marginMm;

  return {
    paperSize,
    orientation,
    layout,
    ticketPosition,
    marginMm,
    fontSizePt,
    copies,
    showCuttingLine,
    paperWidth,
    paperHeight,
    ticketWidth,
    ticketHeight,
    ticketTop,
  };
}

export function isPrintContentOverflowing(
  content,
  config
) {
  if (!content) return true;

  const pxPerMm = 96 / 25.4;

  const maxHeight = config.ticketHeight * pxPerMm;
  const maxWidth = config.ticketWidth * pxPerMm;

  const rect = content.getBoundingClientRect();

  const actualHeight = Math.max(
    rect.height,
    content.scrollHeight
  );

  const actualWidth = Math.max(
    rect.width,
    content.scrollWidth
  );

  return (
    actualHeight > maxHeight ||
    actualWidth > maxWidth + 1
  );
}