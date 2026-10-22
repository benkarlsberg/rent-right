import { readFileSync, writeFileSync } from "node:fs";

const file = "node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js";
const needle = 'external: ["./middleware/handler.mjs"]';
const patched = 'external: ["./middleware/handler.mjs", "cloudflare:sockets"]';

const source = readFileSync(file, "utf8");
if (source.includes(patched)) {
  console.log("OpenNext already leaves cloudflare:sockets external.");
} else if (!source.includes(needle)) {
  throw new Error("OpenNext server bundle external list was not found. Refusing to guess a patch.");
} else {
  writeFileSync(file, source.replaceAll(needle, patched));
  console.log("Left cloudflare:sockets external in the OpenNext server bundle.");
}
