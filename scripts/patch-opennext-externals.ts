import { readFileSync, writeFileSync } from "node:fs";

const file = "node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js";
const patched = 'external: ["./middleware/handler.mjs", "cloudflare:sockets", "cloudflare:workers"]';

const source = readFileSync(file, "utf8");
if (source.includes(patched)) {
  console.log("OpenNext already leaves Cloudflare modules external.");
} else if (!source.includes('"./middleware/handler.mjs"')) {
  throw new Error("OpenNext server bundle external list was not found. Refusing to guess a patch.");
} else {
  writeFileSync(file, source.replace(/external:\s*\[[^\]]*middleware\/handler\.mjs[^\]]*\]/, patched));
  console.log("Left Cloudflare modules external in the OpenNext server bundle.");
}
