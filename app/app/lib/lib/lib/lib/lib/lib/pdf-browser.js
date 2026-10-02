// Browser-only PDF reading. The file never leaves the device.
// Uses the legacy pdf.js build so older phones (before iOS 17.4) still work.
import { pdfDocToText } from './pdf-text.js';

export async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    return await pdfDocToText(doc);
  } finally {
    doc.destroy();
  }
}
