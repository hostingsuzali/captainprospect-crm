/**
 * Chromium path helper for PDF generation on Vercel.
 * Uses @sparticuz/chromium-min to fetch from hosted chromium-pack.tar.
 */
let cachedExecutablePath: string | null = null;
let downloadPromise: Promise<string> | null = null;

const CHROMIUM_PACK_URL =
    process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/chromium-pack.tar`
        : "https://github.com/gabenunez/puppeteer-on-vercel/raw/refs/heads/main/example/chromium-dont-use-in-prod.tar";

export async function getChromiumExecutablePath(): Promise<string> {
    if (cachedExecutablePath) return cachedExecutablePath;
    if (!downloadPromise) {
        const chromium = (await import("@sparticuz/chromium-min")).default;
        downloadPromise = chromium
            .executablePath(CHROMIUM_PACK_URL)
            .then((path) => {
                cachedExecutablePath = path;
                return path;
            })
            .catch((err) => {
                downloadPromise = null;
                throw err;
            });
    }
    return downloadPromise;
}
