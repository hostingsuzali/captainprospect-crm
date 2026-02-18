import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevent bundling pdfkit so its font data files (.afm) resolve correctly at runtime
  serverExternalPackages: ["pdfkit"],
  // Allow larger request bodies for email send (attachments). Default is 1MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
