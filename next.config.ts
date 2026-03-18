import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: true,
  allowedDevOrigins: [process.env.REPLIT_DEV_DOMAIN || "*.replit.dev"],
  // Prevent bundling pdfkit so its font data files (.afm) resolve correctly at runtime
  // puppeteer + @sparticuz/chromium: keep external for PDF generation (Chrome binary)
  serverExternalPackages: ["pdfkit", "puppeteer", "puppeteer-core", "@sparticuz/chromium-min"],
  // Allow larger request bodies for email send (attachments). Default is 1MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
