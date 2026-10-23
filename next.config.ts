import type { NextConfig } from "next";
import path from "path";

const cloudflare = process.env.OPEN_NEXT_CLOUDFLARE === "1";

const nextConfig: NextConfig = {
  serverExternalPackages: cloudflare ? ["pdf-lib", "pdfjs-dist"] : ["pdf-lib", "pdfjs-dist", "postgres"],
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    const alias = config.resolve?.alias;
    config.resolve ??= {};
    const currentAlias = alias && !Array.isArray(alias) ? alias : {};
    if (!cloudflare || !isServer) {
      config.resolve.alias = {
        ...currentAlias,
        "cloudflare:workers": path.join(__dirname, "lib/cloudflare-workers-stub.ts"),
      };
      return config;
    }
    config.resolve.alias = {
      ...currentAlias,
      postgres: path.join(__dirname, "node_modules/postgres/cf/src/index.js"),
    };
    const current = config.externals;
    const externals = Array.isArray(current) ? [...current] : current ? [current] : [];
    externals.push((data: { request?: string }, callback: (error?: null, result?: string) => void) => {
      if (data.request === "cloudflare:sockets" || data.request === "cloudflare:workers") {
        callback(null, `import ${data.request}`);
        return;
      }
      callback();
    });
    config.externals = externals;
    return config;
  },
};

export default nextConfig;
