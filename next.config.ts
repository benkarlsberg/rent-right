import type { NextConfig } from "next";
import path from "path";

const cloudflare = process.env.OPEN_NEXT_CLOUDFLARE === "1";

const nextConfig: NextConfig = {
  serverExternalPackages: cloudflare ? ["pdf-lib", "pdfjs-dist"] : ["pdf-lib", "pdfjs-dist", "postgres"],
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    if (!cloudflare || !isServer) return config;
    const alias = config.resolve?.alias;
    config.resolve ??= {};
    config.resolve.alias = {
      ...(alias && !Array.isArray(alias) ? alias : {}),
      postgres: path.join(__dirname, "node_modules/postgres/cf/src/index.js"),
    };
    const current = config.externals;
    const externals = Array.isArray(current) ? [...current] : current ? [current] : [];
    externals.push((data: { request?: string }, callback: (error?: null, result?: string) => void) => {
      if (data.request === "cloudflare:sockets") {
        callback(null, "import cloudflare:sockets");
        return;
      }
      callback();
    });
    config.externals = externals;
    return config;
  },
};

export default nextConfig;
