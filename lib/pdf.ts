import { readFileSync } from "fs";
import path from "path";
import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { LOGO_PNG } from "@/lib/logo-png";
import type { PacketImage, PacketModel } from "@/lib/packet";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export function pdfText(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\n\r\t\x20-\xFF]/g, "");
}

function pdfSafe(text: string): string {
  return pdfText(text);
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
    const chunks = pdfSafe(text).split("\n");
    const drawWords = (value: string) => {
      const words = value.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        y -= 8;
        return;
      }
      let line = "";
      const flush = (drawn: string) => {
        if (y < margin + 20) newPage();
        page.drawText(drawn, { x: margin, y, size, font: face, color: rgb(0.11, 0.14, 0.18) });
        y -= size + 4;
      };
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
    if (chunks.every((chunk) => !chunk.trim())) {
      y -= 8;
      return;
    }
    for (const chunk of chunks) drawWords(chunk);
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

const INK = rgb(0.08, 0.2, 0.24);
const MUTE = rgb(0.24, 0.35, 0.38);
const PINE = rgb(0.04, 0.36, 0.43);

export async function renderPacket(model: PacketModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(LOGO_PNG.byteLength ? LOGO_PNG : readFileSync(path.join(process.cwd(), "public/email/logo.png")));
  } catch {
    logo = null;
  }
  const width = 612;
  const height = 792;
  const margin = 54;
  const pages: PDFPage[] = [];
  let page = doc.addPage([width, height]);
  pages.push(page);
  let y = height - 72;

  const newPage = () => {
    page = doc.addPage([width, height]);
    pages.push(page);
    y = height - 72;
  };
  const room = (need: number) => {
    if (y - need < 56) newPage();
  };
  const wrap = (value: string, size: number, face: PDFFont, color = INK, gap = 4) => {
    const max = width - margin * 2;
    const chunks = pdfText(value).split("\n");
    for (const chunk of chunks) {
      const words = chunk.split(/\s+/).filter(Boolean);
      if (!words.length) {
        y -= 6;
        continue;
      }
      let line = "";
      const flush = (drawn: string) => {
        room(size + 8);
        page.drawText(drawn, { x: margin, y, size, font: face, color });
        y -= size + gap;
      };
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (face.widthOfTextAtSize(next, size) > max && line) {
          flush(line);
          line = word;
        } else line = next;
      }
      if (line) flush(line);
    }
  };
  const heading = (value: string) => {
    y -= 10;
    wrap(value, 14, bold, PINE, 6);
  };
  const embed = async (image: PacketImage) => {
    try {
      if (image.mime.includes("png")) return await doc.embedPng(image.bytes);
      return await doc.embedJpg(image.bytes);
    } catch {
      return null;
    }
  };
  const thumbs = async (images: PacketImage[]) => {
    let x = margin;
    for (const image of images) {
      const embedded = await embed(image);
      if (!embedded) {
        wrap(image.caption || "A photo is stored.", 10, font);
        continue;
      }
      const scale = Math.min(86 / embedded.width, 86 / embedded.height, 1);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      if (x + w > width - margin) {
        y -= 94;
        x = margin;
      }
      room(h + 16);
      page.drawImage(embedded, { x, y: y - h, width: w, height: h });
      x += w + 8;
      if (x > width - margin - 40) {
        y -= h + 8;
        x = margin;
      }
    }
    if (x !== margin) y -= 94;
  };

  wrap(model.title, 22, bold, PINE, 8);
  wrap(model.about, 10, font, MUTE, 6);
  wrap(`Prepared ${model.prepared}`, 10, font);
  y -= 6;
  wrap(`Tenant: ${model.tenant}`, 11, bold, INK, 3);
  for (const line of model.property) if (line) wrap(line, 11, font);
  wrap(model.place, 11, font);
  wrap(`Landlord: ${model.landlord}`, 11, font);
  wrap(`Monthly rent: ${model.rent}`, 11, font);

  if (model.summary.length) {
    heading("Summary");
    for (const line of model.summary) wrap(line, 11, font);
    if (model.reminderNote) wrap(model.reminderNote, 9, font, MUTE, 4);
  }
  if (model.issues.length) {
    heading("Issues");
    for (const issue of model.issues) {
      y -= 4;
      wrap(issue.title, 12, bold);
      wrap(issue.status, 11, bold, PINE, 3);
      wrap(`Reported ${issue.reported}`, 10, font, MUTE, 3);
      if (issue.reminder) wrap(`Reminder ${issue.reminder}`, 10, font, MUTE, 3);
      wrap(issue.description, 10, font);
      for (const update of issue.updates) wrap(update, 10, font);
      for (const message of issue.messages) {
        wrap(`${message.direction} ${message.when} — ${message.subject}`, 10, bold, INK, 2);
        if (message.excerpt) wrap(message.excerpt, 10, font, MUTE, 3);
      }
      if (issue.images.length) await thumbs(issue.images);
      y -= 4;
    }
  }
  if (model.communications.length) {
    heading("Landlord communications");
    for (const row of model.communications) {
      wrap(`${row.when} — ${row.direction} — ${row.subject}`, 10, bold, INK, 2);
      if (row.excerpt) wrap(row.excerpt, 10, font);
    }
  }
  if (model.conditions.length || model.looseImages.length) {
    heading("Photos");
    for (const report of model.conditions) {
      wrap(`${report.title} — ${report.when} — ${report.images.length === 1 ? "1 photo" : `${report.images.length} photos`}`, 11, bold);
      if (report.images.length) await thumbs(report.images);
    }
    if (model.looseImages.length) await thumbs(model.looseImages);
  }
  if (model.ledger.length) {
    heading("Rent paid");
    for (const line of model.ledger) wrap(line, 10, font);
  }
  if (model.deposit) {
    heading("Security deposit");
    wrap(model.deposit, 10, font);
  }
  if (model.leaseNotes.length) {
    heading("Lease notes");
    for (const line of model.leaseNotes) wrap(line, 10, font);
  }
  if (model.otherNotes.length) {
    heading("Other notes");
    for (const line of model.otherNotes) wrap(line, 10, font);
  }
  if (model.verification.length) {
    heading("Record verification");
    wrap("These records are tamper-evident. Each code is the first 12 characters of the stored hash. A changed record would not match its code.", 9, font, MUTE);
    for (const row of model.verification) wrap(`${row.label} — ${row.code}`, 10, font);
  }
  y -= 8;
  wrap(model.closing, 9, font, MUTE);
  y -= 6;
  wrap(model.disclaimer, 8, font, MUTE);

  pages.forEach((item, index) => {
    if (logo) item.drawImage(logo, { x: margin, y: height - 40, width: 92, height: 18 });
    const label = String(index + 1);
    item.drawText(label, { x: width - margin - font.widthOfTextAtSize(label, 9), y: 28, size: 9, font, color: MUTE });
  });
  doc.setTitle("Evidence packet");
  doc.setAuthor("Rent Right");
  doc.setSubject("Record of communications. Not legal advice.");
  return doc.save();
}
