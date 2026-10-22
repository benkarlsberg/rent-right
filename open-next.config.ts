// Used by the Cloudflare deploy workflow after @opennextjs/cloudflare is installed.
// Excluded from the app typecheck so CI does not need the adapter package.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
