import type jsPDF from 'jspdf';

/** DESIGN.md brand palette for print surfaces (RGB triples for jsPDF). */
export const PDF_BLACK: [number, number, number] = [22, 22, 22]; // colors.ink #161616
export const PDF_YELLOW: [number, number, number] = [15, 98, 254]; // colors.primary #0f62fe — legit brand use, the banner is the CTA-banner analog
export const PDF_ZEBRA: [number, number, number] = [244, 244, 244]; // colors.surface-1 #f4f4f4

export const PDF_HEAD_STYLES = { fillColor: PDF_BLACK };
export const PDF_ALTERNATE_ROW_STYLES = { fillColor: PDF_ZEBRA };

/** Charcoal brand banner with the 2mm blue band underneath (A4 portrait width). */
export function drawPdfBrandHeader(doc: jsPDF, height: number) {
  doc.setFillColor(...PDF_BLACK);
  doc.rect(0, 0, 210, height, 'F');
  doc.setFillColor(...PDF_YELLOW);
  doc.rect(0, height, 210, 2, 'F');
}
