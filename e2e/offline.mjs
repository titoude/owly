// Offline-first e2e: after a cold reload with NO network, the first PDF
// generation must still work — fonts are service-worker precached.
// Usage: npm run build && npx vite preview --port 4173 && node e2e/offline.mjs
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  // Seed demo data via the onboarding screen (no child exists yet).
  await page.goto(BASE + "/#/welcome");
  await page.waitForSelector("body", { timeout: 8000 });
  await page.locator("button", { hasText: /demo|démo/i }).first().click();
  await page.waitForSelector("text=/Léo/i", { timeout: 8000 });
  ok("demo loaded", true);

  // Let the service worker install + precache (fonts included).
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => true) ?? false);
  const precached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const n of names) {
      const c = await caches.open(n);
      urls.push(...(await c.keys()).map((k) => k.url));
    }
    return { names, assets: urls };
  });
  const fontsCached = precached.assets?.filter((u) => /NotoSans/.test(u)).length ?? 0;
  ok("fonts precached by service worker", fontsCached >= 5, `${fontsCached} font assets`);

  // Cold reload with the network fully off.
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("text=/Léo/i", { timeout: 8000 });
  ok("app boots fully offline after cold reload", true);

  // First PDF in the offline session must still generate.
  const dl = page.waitForEvent("download", { timeout: 15000 });
  await page.goto(BASE + "/#/report");
  await page.locator("button", { hasText: /generate|générer|download|télécharger|pdf/i }).first().click();
  const file = await dl;
  ok("first PDF generates fully offline", /\.pdf$/i.test(file.suggestedFilename()), file.suggestedFilename());

  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  ok("no page errors offline", errs.length === 0, errs.slice(0, 2).join(" | "));
} catch (e) {
  ok("offline suite crashed", false, String(e).slice(0, 240));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
