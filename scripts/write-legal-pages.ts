import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { injectHomeHtml, privacyDocument, termsDocument } from "../lib/legal-html";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function writePublic(): void {
  const privacyDir = join(root, "mobile/public/privacy");
  const termsDir = join(root, "mobile/public/terms");
  mkdirSync(privacyDir, { recursive: true });
  mkdirSync(termsDir, { recursive: true });
  writeFileSync(join(privacyDir, "index.html"), privacyDocument);
  writeFileSync(join(termsDir, "index.html"), termsDocument);
}

function injectHome(): void {
  const indexPath = join(root, "mobile/dist/index.html");
  if (!existsSync(indexPath)) return;
  writeFileSync(indexPath, injectHomeHtml(readFileSync(indexPath, "utf8")));
}

writePublic();
if (process.argv.includes("--inject")) injectHome();
