import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SHARE_TAGLINE } from "../lib/share-meta";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = "#E6F0EE";
const INK = "#0B5C6E";

function textSvg(logoHeight: number, top: number): string {
  const splitAt = SHARE_TAGLINE.lastIndexOf(", ");
  const firstLine = `${SHARE_TAGLINE.slice(0, splitAt)},`;
  const secondLine = SHARE_TAGLINE.slice(splitAt + 2);
  const textTop = top + logoHeight + 56;
  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<text x="${WIDTH / 2}" y="${textTop}" text-anchor="middle" font-family="Inter, sans-serif" font-size="32" fill="${INK}">
<tspan x="${WIDTH / 2}">${firstLine}</tspan>
<tspan x="${WIDTH / 2}" dy="44">${secondLine}</tspan>
</text>
</svg>`;
}

async function main(): Promise<void> {
  const logoWidth = 900;
  const logo = await sharp(readFileSync(join(root, "public/brand/logo.svg")))
    .resize({ width: logoWidth })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const logoHeight = meta.height ?? Math.round(logoWidth * (2088 / 7984));
  const renderedWidth = meta.width ?? logoWidth;
  const top = Math.round((HEIGHT - logoHeight - 100) / 2);
  const left = Math.round((WIDTH - renderedWidth) / 2);
  const card = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: BACKGROUND },
  })
    .composite([
      { input: logo, left, top },
      { input: Buffer.from(textSvg(logoHeight, top)), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  if (card.length >= 5 * 1024 * 1024) throw new Error(`Preview image is ${card.length} bytes.`);
  const info = await sharp(card).metadata();
  if (info.width !== WIDTH || info.height !== HEIGHT) throw new Error(`Preview image is ${info.width}x${info.height}.`);
  for (const dir of [join(root, "public"), join(root, "mobile/public")]) {
    writeFileSync(join(dir, "og.png"), card);
  }
  console.log(`Wrote og.png ${info.width}x${info.height} ${card.length} bytes. ${SHARE_TAGLINE}`);
}

main();
