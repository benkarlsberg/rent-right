import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib", "pdfjs-dist", "postgres"],
  poweredByHeader: false,
};

export default nextConfig;
