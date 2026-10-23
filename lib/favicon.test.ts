import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("favicon files", () => {
  it("ships a square house icon at the sizes the browser asks for", () => {
    expect(pngSize(join(root, "public/favicon-16x16.png"))).toEqual({ width: 16, height: 16 });
    expect(pngSize(join(root, "public/favicon-32x32.png"))).toEqual({ width: 32, height: 32 });
    expect(pngSize(join(root, "public/apple-touch-icon.png"))).toEqual({ width: 180, height: 180 });
    expect(pngSize(join(root, "public/icons/icon-192.png"))).toEqual({ width: 192, height: 192 });
    expect(pngSize(join(root, "public/icons/icon-512.png"))).toEqual({ width: 512, height: 512 });
    const ico = readFileSync(join(root, "public/favicon.ico"));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([ico[6], ico[22], ico[38]]).toEqual([16, 32, 48]);
    const svg = readFileSync(join(root, "public/favicon.svg"), "utf8");
    expect(svg).toContain("#3DDBB8");
    expect(svg).toContain("#0B5C6E");
    expect(svg).toContain("#FFFFFF");
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toContain("M308");
    expect(svg).not.toContain('fill="#FFFFFF" width="16"');
    const manifest = JSON.parse(readFileSync(join(root, "mobile/public/manifest.webmanifest"), "utf8"));
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      "/icons/icon-192.png?v=3",
      "/icons/icon-512.png?v=3",
      "/icons/icon-maskable-192.png?v=3",
      "/icons/icon-maskable-512.png?v=3",
    ]);
    expect(readFileSync(join(root, "public/apple-touch-icon.png"))[25]).toBe(2);
    expect(pngSize(join(root, "mobile/assets/icon.png"))).toEqual({ width: 1024, height: 1024 });
    expect(readFileSync(join(root, "mobile/assets/icon.png"))[25]).toBe(2);
    expect(pngSize(join(root, "mobile/assets/android-icon-foreground.png"))).toEqual({ width: 1024, height: 1024 });
    expect(readFileSync(join(root, "mobile/assets/android-icon-foreground.png"))[25]).toBe(6);
    expect(pngSize(join(root, "mobile/assets/android-icon-background.png"))).toEqual({ width: 1024, height: 1024 });
    expect(readFileSync(join(root, "mobile/assets/android-icon-background.png"))[25]).toBe(2);
    expect(readFileSync(join(root, "mobile/public/favicon.svg"), "utf8")).toBe(svg);
  });
});
