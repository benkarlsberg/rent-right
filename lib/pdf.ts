import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function pdfSafe(text: string): string {
  return text.replace(/[^\n\r\t\x20-\xff]/g, "?");
}

export async function renderPdf(title: string, blocks: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 54;
  const width = 612;
  const height = 792;
  let page = doc.addPage([width, height]);
  let y = height - margin;

  const newPage = () => {
    page = doc.addPage([width, height]);
    y = height - margin;
  };

  const drawParagraph = (text: string, size: number, isBold: boolean) => {
    const face = isBold ? bold : font;
    const max = width - margin * 2;
    const words = pdfSafe(text).split(/\s+/).filter(Boolean);
    let line = "";
    const flush = (value: string) => {
      if (y < margin + 20) newPage();
      page.drawText(value, { x: margin, y, size, font: face, color: rgb(0.11, 0.14, 0.18) });
      y -= size + 4;
    };
    if (words.length === 0) {
      y -= 8;
      return;
    }
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) > max && line) {
        flush(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) flush(line);
  };

  drawParagraph(title, 16, true);
  y -= 4;
  drawParagraph("Factual compilation of records stored by the tenant. Not a legal analysis.", 9, false);
  y -= 8;
  for (const block of blocks) {
    if (block.startsWith("# ")) {
      y -= 6;
      drawParagraph(block.slice(2), 12, true);
      y -= 2;
    } else {
      drawParagraph(block, 10, false);
    }
  }
  y -= 10;
  drawParagraph(DISCLAIMER_EN, 8, false);
  doc.setTitle(pdfSafe(title));
  doc.setAuthor("Rent Right");
  doc.setSubject("General information. Not legal advice.");
  return doc.save();
}
