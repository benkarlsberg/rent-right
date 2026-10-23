import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const house = "M11 100 L116 12 L221 100 V246 H11 Z";
const door = "M77 236 V146 H146 V236";
const check = "M132 192 L160 220 L228 160";

function markSvg(padRatio: number): string {
  const thicken = 1.35;
  const houseStroke = 20 * thicken;
  const doorStroke = 16 * thicken;
  const checkStroke = 26 * thicken;
  const minX = 11 - houseStroke / 2;
  const maxX = 228 + checkStroke / 2;
  const minY = 12 - houseStroke / 2;
  const maxY = 246 + houseStroke / 2;
  const width = maxX - minX;
  const height = maxY - minY;
  const size = 64;
  const pad = size * padRatio;
  const scale = (size - pad * 2) / Math.max(width, height);
  const ox = (size - width * scale) / 2 - minX * scale;
  const oy = (size - height * scale) / 2 - minY * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" role="img" aria-label="Rent Right">
<title>Rent Right</title>
<rect width="${size}" height="${size}" fill="#FFFFFF"/>
<g transform="translate(${ox.toFixed(3)} ${oy.toFixed(3)}) scale(${scale.toFixed(5)})">
<path d="${house}" stroke="#0B5C6E" stroke-width="${houseStroke.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>
<path d="${door}" stroke="#0B5C6E" stroke-width="${doorStroke.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>
<path d="${check}" stroke="#14A38B" stroke-width="${checkStroke.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>
</g>
</svg>`;
}

function sizedSvg(svg: string, pixels: number): Buffer {
  return Buffer.from(svg.replace("<svg ", `<svg width="${pixels}" height="${pixels}" `));
}

async function png(svg: string, pixels: number): Promise<Buffer> {
  return sharp(sizedSvg(svg, pixels)).png().toBuffer();
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
    const dim = image.size >= 256 ? 0 : image.size;
    header.writeUInt8(dim, entry);
    header.writeUInt8(dim, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.png.length;
  }
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const manifest = {
  name: "Rent Right",
  short_name: "Rent Right",
  description: "AI tenant-landlord communication assistant for California renters.",
  start_url: "/",
  display: "standalone",
  background_color: "#F8FAF9",
  theme_color: "#0B5C6E",
  lang: "en",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

function write(path: string, data: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

async function main(): Promise<void> {
  const icon = markSvg(0.1);
  const maskable = markSvg(0.14);
  const sizes = {
    16: await png(icon, 16),
    32: await png(icon, 32),
    48: await png(icon, 48),
    180: await png(icon, 180),
    192: await png(icon, 192),
    512: await png(icon, 512),
  };
  const mask = {
    192: await png(maskable, 192),
    512: await png(maskable, 512),
  };
  const favicon = ico([
    { size: 16, png: sizes[16] },
    { size: 32, png: sizes[32] },
    { size: 48, png: sizes[48] },
  ]);

  for (const dir of [join(root, "public"), join(root, "mobile/public")]) {
    write(join(dir, "favicon.svg"), icon);
    write(join(dir, "favicon.ico"), favicon);
    write(join(dir, "favicon-16x16.png"), sizes[16]);
    write(join(dir, "favicon-32x32.png"), sizes[32]);
    write(join(dir, "apple-touch-icon.png"), sizes[180]);
    write(join(dir, "icons/icon-192.png"), sizes[192]);
    write(join(dir, "icons/icon-512.png"), sizes[512]);
    write(join(dir, "icons/icon-maskable-192.png"), mask[192]);
    write(join(dir, "icons/icon-maskable-512.png"), mask[512]);
  }
  write(join(root, "mobile/public/manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);
  write(join(root, "mobile/assets/favicon.png"), sizes[48]);
  write(join(root, "app/icon.png"), sizes[32]);
  write(join(root, "app/apple-icon.png"), sizes[180]);
}

main();
