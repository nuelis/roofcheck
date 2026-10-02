// Turns a loaded pdf.js document into layout-preserving text.
// Shared by the browser wrapper and the Node tests so both run the same code.
import { itemsToLines } from './lines.js';

export async function pdfDocToText(doc) {
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => 'str' in i)
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    pages.push(itemsToLines(items));
  }
  return pages.join('\n');
}
