import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TILE = "#0B5C6E";
const WHITE = "#FFFFFF";
const CHECK = "#3DDBB8";

// 16px tab icon. Corner radius is about 22% (the first two pixels of each corner
// are clear). Strokes are 2px so the house, door slot, and check stay solid.
const rows = [
  "..TTTTTTTTTTTT..",
  ".TTTTTTTTTTTTTT.",
  "TTTTTWWTTTTTTTTT",
  "TTTTWWWWTTTTTTTT",
  "TTTWWTTWWTTTTTTT",
  "TTWWTTTTWWTTTTTT",
  "TWWTTTTTTWWTTTTT",
  "TWWWWWWWWWWTTTMM",
  "TWWWWTTWWWWTTTMM",
  "TWWWWTTWWWTTMMMT",
  "TWWWWTTWWWTMMMMT",
  "TWWWWTTWWWTTMMTT",
  "TWWWWTTWWWWTMMMT",
  "TTTTTTTTTTTTTMTT",
  ".TTTTTTTTTTTTTT.",
  "..TTTTTTTTTTTT..",
];

const pixelFill: Record<string, string> = { T: TILE, W: WHITE, M: CHECK };
const pixelRgba: Record<string, [number, number, number, number]> = {
  T: [11, 92, 110, 255],
  W: [255, 255, 255, 255],
  M: [61, 219, 184, 255],
  ".": [0, 0, 0, 0],
};

function pixelSvg(): string {
  const rects: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const kind = row[x];
      if (kind === ".") {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === kind) end += 1;
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${pixelFill[kind]}"/>`);
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="Rent Right"><title>Rent Right</title>${rects.join("")}</svg>`;
}

function pixelBuffer(): Buffer {
  const raw = Buffer.alloc(16 * 16 * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const rgba = pixelRgba[row[x]];
      raw.set(rgba, (y * 16 + x) * 4);
    }
  });
  return raw;
}

async function nearest(raw: Buffer, pixels: number): Promise<Buffer> {
  return sharp(raw, { raw: { width: 16, height: 16, channels: 4 } })
    .resize(pixels, pixels, { kernel: "nearest" })
    .png()
    .toBuffer();
}

function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const entry = 6 + index * 16;
    header.writeUInt8(image.size >= 256 ? 0 : image.size, entry);
    header.writeUInt8(image.size >= 256 ? 0 : image.size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.png.length;
  }
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

function write(path: string, data: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

async function main(): Promise<void> {
  const raw = pixelBuffer();
  const icon = pixelSvg();
  const sizes = {
    16: await nearest(raw, 16),
    32: await nearest(raw, 32),
    48: await nearest(raw, 48),
  };
  const favicon = ico([
    { size: 16, png: sizes[16] },
    { size: 32, png: sizes[32] },
    { size: 48, png: sizes[48] },
  ]);

  // Tab icons only. The header lockup, apple-touch, PWA, and store icons are
  // rendered from the traced house mark and must not be replaced by this tile.
  for (const dir of [join(root, "public"), join(root, "mobile/public")]) {
    write(join(dir, "favicon.svg"), icon);
    write(join(dir, "favicon.ico"), favicon);
    write(join(dir, "favicon-16x16.png"), sizes[16]);
    write(join(dir, "favicon-32x32.png"), sizes[32]);
  }
  write(join(root, "mobile/assets/favicon.png"), sizes[48]);
  write(join(root, "app/icon.png"), sizes[32]);
}

main();
