import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ["./test/setup.ts"],
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
      "cloudflare:workers": path.resolve(__dirname, "lib/cloudflare-workers-stub.ts"),
    },
  },
});
