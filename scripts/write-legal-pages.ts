import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteAccountDocument, injectHomeHtml, privacyDocument, termsDocument } from "../lib/legal-html";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function writePublic(): void {
  const privacyDir = join(root, "mobile/public/privacy");
  const termsDir = join(root, "mobile/public/terms");
  const deleteDir = join(root, "mobile/public/delete-account");
  mkdirSync(privacyDir, { recursive: true });
  mkdirSync(termsDir, { recursive: true });
  mkdirSync(deleteDir, { recursive: true });
  writeFileSync(join(privacyDir, "index.html"), privacyDocument);
  writeFileSync(join(termsDir, "index.html"), termsDocument);
  writeFileSync(join(deleteDir, "index.html"), deleteAccountDocument);
}

const iconFiles = [
  "favicon.ico",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "manifest.webmanifest",
  "_headers",
];

function copyIcons(): void {
  const dist = join(root, "mobile/dist");
  if (!existsSync(dist)) return;
  const pub = join(root, "mobile/public");
  for (const name of iconFiles) {
    const from = join(pub, name);
    if (existsSync(from)) copyFileSync(from, join(dist, name));
  }
  const icons = join(dist, "icons");
  mkdirSync(icons, { recursive: true });
  for (const name of readdirSync(join(pub, "icons"))) {
    if (name.endsWith(".png")) copyFileSync(join(pub, "icons", name), join(icons, name));
  }
}

function injectHome(): void {
  const indexPath = join(root, "mobile/dist/index.html");
  if (existsSync(indexPath)) writeFileSync(indexPath, injectHomeHtml(readFileSync(indexPath, "utf8")));
  copyIcons();
}

writePublic();
if (process.argv.includes("--inject")) injectHome();
