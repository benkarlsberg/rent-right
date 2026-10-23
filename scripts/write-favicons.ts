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

function smoothSvg(options: { square: boolean; markOnly: boolean; mono: boolean; inset: number }): string {
  const background = options.markOnly
    ? ""
    : options.square
      ? `<rect width="64" height="64" fill="${TILE}"/>`
      : `<rect width="64" height="64" rx="14" fill="${TILE}"/>`;
  const check = options.mono ? WHITE : CHECK;
  const scale = options.inset;
  const group = scale === 1 ? "" : ` transform="translate(32 32) scale(${scale}) translate(-32 -32)"`;
  const houseMask = options.mono ? ` mask="url(#gap)"` : "";
  const defs = options.mono
    ? `<mask id="gap"><rect width="64" height="64" fill="${WHITE}"/><path d="M46 38 L54 50 L62 32" stroke="#000000" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/></mask>`
    : "";
  const halo = options.mono
    ? ""
    : `<path d="M46 38 L54 50 L62 32" stroke="${TILE}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
${background}
<g${group}>
${defs}
<g${houseMask}>
<path d="M9 33 L26 12 L43 33 V54 H9 Z" stroke="${WHITE}" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M20 54 V40 H32 V54" stroke="${WHITE}" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>
</g>
${halo}
<path d="M46 38 L54 50 L62 32" stroke="${check}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
</g>
</svg>`;
}

async function raster(svg: string, pixels: number, flatten: boolean): Promise<Buffer> {
  const sized = svg.replace("<svg ", `<svg width="${pixels}" height="${pixels}" `);
  let image = sharp(Buffer.from(sized)).resize(pixels, pixels, { fit: "fill" });
  if (flatten) image = image.flatten({ background: TILE });
  return image.png().toBuffer();
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

const manifest = {
  name: "Rent Right",
  short_name: "Rent Right",
  description: "AI tenant-landlord communication assistant for California renters.",
  start_url: "/",
  display: "standalone",
  background_color: "#F8FAF9",
  theme_color: TILE,
  lang: "en",
  icons: [
    { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

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
  const rounded = smoothSvg({ square: false, markOnly: false, mono: false, inset: 1 });
  const square = smoothSvg({ square: true, markOnly: false, mono: false, inset: 1 });
  const maskable = smoothSvg({ square: true, markOnly: false, mono: false, inset: 0.8 });
  const foreground = smoothSvg({ square: false, markOnly: true, mono: false, inset: 0.8 });
  const monochrome = smoothSvg({ square: false, markOnly: true, mono: true, inset: 0.8 });
  const large = {
    180: await raster(square, 180, true),
    192: await raster(rounded, 192, false),
    512: await raster(rounded, 512, false),
    1024: await raster(square, 1024, true),
  };
  const mask = {
    192: await raster(maskable, 192, true),
    512: await raster(maskable, 512, true),
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
    write(join(dir, "apple-touch-icon.png"), large[180]);
    write(join(dir, "icons/icon-192.png"), large[192]);
    write(join(dir, "icons/icon-512.png"), large[512]);
    write(join(dir, "icons/icon-maskable-192.png"), mask[192]);
    write(join(dir, "icons/icon-maskable-512.png"), mask[512]);
  }
  write(join(root, "mobile/public/manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);
  write(join(root, "mobile/assets/favicon.png"), sizes[48]);
  write(join(root, "mobile/assets/icon.png"), large[1024]);
  write(join(root, "mobile/assets/android-icon-background.png"), await raster(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${TILE}"/></svg>`, 1024, true));
  write(join(root, "mobile/assets/android-icon-foreground.png"), await raster(foreground, 1024, false));
  write(join(root, "mobile/assets/android-icon-monochrome.png"), await raster(monochrome, 1024, false));
  write(join(root, "app/icon.png"), sizes[32]);
  write(join(root, "app/apple-icon.png"), large[180]);
}

main();
