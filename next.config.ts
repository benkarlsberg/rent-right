import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib", "pdfjs-dist"],
  poweredByHeader: false,
};

export default nextConfig;
