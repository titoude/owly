// E2E for the carer-facing features on the PRODUCTION build: pain passport,
// on-screen report, printing, and night mode.
// Usage: npm run build && npx vite preview --port 4173 && node e2e/features.mjs
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
const go = (p, h) => p.evaluate((x) => { location.hash = x; }, h);
// Page count straight from the PDF bytes Chromium prints.
const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem("owly-lang")) localStorage.setItem("owly-lang", "en");
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

try {
  await page.goto(BASE + "/#/welcome");
  await page.locator("button", { hasText: /demo/i }).first().click();
  await page.waitForSelector("nav.fixed", { state: "visible", timeout: 10000 });

  // ── Pain passport ─────────────────────────────────────────
  const entry = page.locator("main a", { hasText: /pain passport/i });
  // The dashboard renders once the demo child is active — wait, don't sample.
  await entry.first().waitFor({ timeout: 8000 }).catch(() => {});
  ok("dashboard links the pain passport", (await entry.count()) === 1);
  await entry.click();
  await page.waitForSelector("#passport-title", { timeout: 8000 });
  const pp = await page.locator("article").innerText();
  ok("passport names the child", /Léo's pain passport/.test(pp));
  ok("passport lists the child's own signs", /grimaces, bites lower lip/.test(pp) && /Pulls at ears/.test(pp));
  ok("passport shows what has helped, with outcomes", /Calmer environment[\s\S]*3\/3/.test(pp), pp.match(/What has helped[\s\S]{0,110}/)?.[0].replace(/\n+/g, " · "));
  ok("passport never suggests medication", !/ibuprofen|Medication/i.test(pp));
  ok("passport carries the emergency list", /Call emergency services immediately if[\s\S]*Trouble breathing/.test(pp));
  ok("passport states it is not a diagnosis", /not a diagnosis/i.test(pp));
  ok("one h1 on the passport", (await page.locator("h1").count()) === 1);

  await page.emulateMedia({ media: "print" });
  ok("print hides the app chrome", !(await page.locator("header").first().isVisible()) && !(await page.locator("nav.fixed").isVisible()));
  ok("print shows the hand-written contact lines", await page.locator("#pp-contacts").isVisible());
  ok("print hides the on-screen actions", !(await page.locator("button", { hasText: /print or save/i }).isVisible()));
  const passportPdf = await page.pdf({ format: "A4", printBackground: true });
  ok("passport prints on a single A4 page", pdfPages(passportPdf) === 1, `${pdfPages(passportPdf)} page(s)`);
  await page.emulateMedia({ media: "screen" });
  ok("contact lines are paper-only", !(await page.locator("#pp-contacts").isVisible()));

  // ── On-screen report ─────────────────────────────────────
  await go(page, "#/report");
  await page.locator("input.input").first().waitFor({ timeout: 8000 });
  await page.locator("button", { hasText: /^All$/ }).click();
  await page.locator("input.input").first().fill("Could this be an ear infection?");
  await page.locator("button", { hasText: /read the report on screen/i }).click();
  await page.waitForSelector("#rv-title", { timeout: 8000 });
  const rows = await page.locator("table tbody tr").count();
  ok("report table has one row per episode", rows === 8, `${rows} rows`);
  ok("rows are headed by their date", (await page.locator('tbody th[scope="row"]').count()) === rows);
  ok("table has a caption and column headers", (await page.locator("table caption").count()) === 1 && (await page.locator('thead th[scope="col"]').count()) === 6);
  const rv = await page.locator("article").innerText();
  ok("question reaches the on-screen report", /Could this be an ear infection\?/.test(rv));
  ok("period matches the selection", /all recorded observations/i.test(rv));
  ok("same summary numbers as the PDF", /8 episodes, average FLACC 7\.5\/10 \(max 10\)/.test(rv));
  const scroller = page.locator('[role="region"][tabindex="0"]');
  await scroller.focus();
  ok("wide table scrolls by keyboard", await scroller.evaluate((el) => el === document.activeElement && el.scrollWidth > el.clientWidth));
  await page.locator("a", { hasText: /back to report options/i }).click();
  await page.locator("input.input").first().waitFor();
  ok("back keeps the typed question", (await page.locator("input.input").first().inputValue()) === "Could this be an ear infection?");
  ok("back keeps the chosen period", (await page.locator("button", { hasText: /^All$/ }).getAttribute("aria-pressed")) === "true");

  // ── Night mode ───────────────────────────────────────────
  await go(page, "#/settings");
  const night = page.getByRole("radio", { name: "Night" });
  await night.waitFor({ timeout: 8000 });
  ok("appearance defaults to automatic", await page.getByRole("radio", { name: "Automatic" }).isChecked());
  await page.getByRole("radio", { name: "Automatic" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  ok("arrow keys choose night mode", await night.isChecked());
  ok("night mode applies at once", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  ok("browser chrome colour follows", (await page.locator('meta[name="theme-color"]').getAttribute("content")) === "#1d1c1a");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok("page background is dark", bg === "rgb(22, 21, 19)", bg);
  await page.reload();
  await page.waitForSelector("nav.fixed", { state: "visible" });
  ok("night mode survives a reload", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await go(page, "#/passport");
  await page.waitForSelector("#passport-title");
  await page.emulateMedia({ media: "print" });
  const printBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok("printing from night mode still prints on white", printBg === "rgb(255, 255, 255)", printBg);
  await page.emulateMedia({ media: "screen" });
  await go(page, "#/settings");
  await page.locator("label", { hasText: /^Light$/ }).click(); // the visible control is the label
  ok("light mode switches back", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light");

  // ── Device preference + RTL ─────────────────────────────
  const dctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  await dctx.addInitScript(() => localStorage.setItem("owly-lang", "ar"));
  const dp = await dctx.newPage();
  await dp.goto(BASE + "/#/welcome");
  ok("automatic follows a dark device", (await dp.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await dp.locator("button.btn-ghost").first().click(); // "explore the demo" (localized label)
  await dp.waitForSelector("nav.fixed", { state: "visible", timeout: 10000 });
  await go(dp, "#/passport");
  await dp.waitForSelector("#passport-title");
  ok("passport renders right-to-left in Arabic", (await dp.evaluate(() => document.documentElement.dir)) === "rtl" && /جواز الألم/.test(await dp.locator("h1").innerText()));
  await dctx.close();
} catch (e) {
  ok("suite completed", false, e.message.split("\n")[0]);
}

ok("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
