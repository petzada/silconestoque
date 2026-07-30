import type jsPDF from 'jspdf';

/** DESIGN.md brand palette for print surfaces (RGB triples for jsPDF). */
export const PDF_BLACK: [number, number, number] = [22, 22, 22]; // colors.ink #161616
// Renomeado de PDF_YELLOW (Etapa 8): o valor sempre foi azul, nunca amarelo — o
// nome antigo mentia. Zero call sites externos na migração; só drawPdfBrandHeader usava.
export const PDF_BLUE: [number, number, number] = [15, 98, 254]; // colors.primary #0f62fe — legit brand use, the banner is the CTA-banner analog
export const PDF_ZEBRA: [number, number, number] = [244, 244, 244]; // colors.surface-1 #f4f4f4
export const PDF_WHITE: [number, number, number] = [255, 255, 255]; // colors.on-primary / inverse-ink #ffffff — texto sobre o banner escuro
export const PDF_RED: [number, number, number] = [218, 30, 40]; // colors.semantic-error #da1e28 (red-60) — nunca o red-500 do Tailwind

export const PDF_HEAD_STYLES = { fillColor: PDF_BLACK };
export const PDF_ALTERNATE_ROW_STYLES = { fillColor: PDF_ZEBRA };

/** Charcoal brand banner with the 2mm blue band underneath (A4 portrait width). */
export function drawPdfBrandHeader(doc: jsPDF, height: number) {
  doc.setFillColor(...PDF_BLACK);
  doc.rect(0, 0, 210, height, 'F');
  doc.setFillColor(...PDF_BLUE);
  doc.rect(0, height, 210, 2, 'F');
}
