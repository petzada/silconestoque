import type jsPDF from 'jspdf';

/** DESIGN.md brand palette for print surfaces (RGB triples for jsPDF). */
export const PDF_BLACK: [number, number, number] = [10, 10, 10];
export const PDF_YELLOW: [number, number, number] = [250, 255, 105];
export const PDF_ZEBRA: [number, number, number] = [245, 245, 245];

export const PDF_HEAD_STYLES = { fillColor: PDF_BLACK };
export const PDF_ALTERNATE_ROW_STYLES = { fillColor: PDF_ZEBRA };

/** Black brand banner with the 2mm yellow band underneath (A4 portrait width). */
export function drawPdfBrandHeader(doc: jsPDF, height: number) {
  doc.setFillColor(...PDF_BLACK);
  doc.rect(0, 0, 210, height, 'F');
  doc.setFillColor(...PDF_YELLOW);
  doc.rect(0, height, 210, 2, 'F');
}
