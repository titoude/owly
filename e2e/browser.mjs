import { chromium } from "playwright";

// Chrome resolution order: CHROME_PATH env → Playwright's bundled chromium
// (npx playwright install chromium) → common system installs.
const CANDIDATES = [
  process.env.CHROME_PATH,
  undefined,
  `${process.env.HOME}/.local/bin/google-chrome`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
].filter((v) => v === undefined || (typeof v === "string" && v !== ""));

export async function launchBrowser() {
  let lastErr;
  for (const executablePath of CANDIDATES) {
    try {
      return await chromium.launch(executablePath ? { executablePath } : {});
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `No usable Chrome/Chromium found. Run \`npx playwright install chromium\` or set CHROME_PATH. (${lastErr?.message ?? ""})`,
  );
}
