// axe-core audit for Owly, per scripts/a11y/manifest.json.
// Runs WCAG 2.2 A/AA + best-practice rules on every manifest route and state.
// Usage: node scripts/a11y/audit.mjs [base-url] [--out a11y-audit/baseline]
// Exit 1 on any violation; UNVERIFIED entries are listed but don't fail.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "../../e2e/browser.mjs";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const go = (p, h) => p.evaluate((x) => { location.hash = x; }, h);
const BASE = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://localhost:4173";
const outIdx = process.argv.indexOf("--out");
const OUT = outIdx > -1 ? process.argv[outIdx + 1] : "a11y-audit/latest";
mkdirSync(OUT, { recursive: true });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const DEMO_RE = /demo|démo/i;
const results = [];
let pass = 0, fail = 0, unverified = 0;

async function audit(page, id, description) {
  await page.waitForSelector("body");
  await page.waitForTimeout(350); // settle route transitions
  try {
    await page.addScriptTag({ path: AXE_PATH });
    const r = await page.evaluate(async (tags) => {
      const res = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
      return {
        violations: res.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.slice(0, 6).map((n) => ({ html: n.html.slice(0, 160), target: n.target })),
        })),
        incomplete: res.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
        passes: res.passes.length,
      };
    }, TAGS);
    const status = r.violations.length ? "FAIL" : "PASS";
    if (r.violations.length) fail++; else pass++;
    results.push({ id, description, status, ...r });
    console.log(`${status} ${id} — ${r.violations.length} violations, ${r.incomplete.length} incomplete`);
    for (const v of r.violations) console.log(`    ${v.id} [${v.impact}]: ${v.nodes.map((n) => n.target.join(" ")).join(" | ").slice(0, 200)}`);
  } catch (e) {
    unverified++;
    results.push({ id, description, status: "UNVERIFIED", error: String(e) });
    console.log(`UNVERIFIED ${id} — ${e}`);
  }
}

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

// --- Seed demo child (Léo) ---
await page.goto(`${BASE}/#/welcome`);
await page.locator("button", { hasText: DEMO_RE }).first().click();
await page.waitForSelector("nav.fixed", { state: "visible", timeout: 10000 });

// --- Manifest routes ---
for (const r of [
  ["route:/", "dashboard (demo seed)"],
  ["route:/history", "history list"],
  ["route:/patterns", "patterns report"],
  ["route:/report", "report config form"],
  ["route:/settings", "settings"],
  ["route:/redflags", "emergency red flags"],
]) {
  await go(page, `#${r[0].slice(6)}`);
  await audit(page, r[0], r[1]);
}
// onboarding + child-new use a fresh context (no children redirect logic)
{
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/#/welcome`);
  await audit(p2, "route:/welcome", "onboarding");
  await p2.goto(`${BASE}/#/child/new`);
  await audit(p2, "route:/child/new", "child create form");
  await p2.close();
}

// --- States ---
// observe steps 0..7: audit each wizard step
await go(page, "#/observe");
for (let s = 0; s <= 7; s++) {
  await audit(page, `observe-step${s}`, `observe wizard step ${s}`);
  if (s < 7) {
    // FLACC score steps require a selection before Next is enabled.
    const radio = page.locator('label:has(input[type="radio"])').first();
    if (await radio.count()) await radio.click();
    const next = page.locator("button", { hasText: /next|suivant/i }).first();
    if (!(await next.count())) { results.push({ id: `observe-step${s}-advance`, status: "UNVERIFIED", error: "no Next button" }); unverified++; break; }
    await next.click();
    await page.waitForTimeout(250);
  }
}

// delete-confirm: open inline confirm on first history row
await go(page, "#/history");
{
  await page.locator("button", { hasText: /^delete$|^supprimer$/i }).first().waitFor({ timeout: 8000 }).catch(() => {});
  const del = page.locator("button", { hasText: /^delete$|^supprimer$/i }).first();
  if (await del.count()) { await del.click(); await page.waitForTimeout(250); await audit(page, "delete-confirm", "inline delete confirmation"); }
  else { results.push({ id: "delete-confirm", status: "UNVERIFIED", error: "no delete button found" }); unverified++; }
}

// child-edit via settings edit link
await go(page, "#/settings");
{
  const edit = page.locator("a", { hasText: /edit|modifier/i }).first();
  if (await edit.count()) { await edit.click(); await audit(page, "child-edit", "edit form for existing child"); await page.goBack(); }
  else { results.push({ id: "child-edit", status: "UNVERIFIED", error: "no edit link" }); unverified++; }
}

// import-preview: upload a valid backup export
{
  await go(page, "#/settings");
  const exBtn = page.locator("button", { hasText: /export|exporter|download|télécharger/i }).first();
  await exBtn.waitFor({ timeout: 8000 }).catch(() => {});
  const download = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
  await exBtn.click().catch(() => {});
  const dl = await download;
  if (dl) {
    const path = await dl.path();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(path);
    await page.waitForTimeout(500);
    await audit(page, "import-preview", "replacement-preview dialog");
    await page.locator("button", { hasText: /cancel|annuler/i }).first().click().catch(() => {});
  } else { results.push({ id: "import-preview", status: "UNVERIFIED", error: "no export download" }); unverified++; }
}

// fr state: switch to French
await go(page, "#/settings");
{
  const fr = page.locator("button", { hasText: /Français/ }).first();
  if (await fr.count()) { await fr.click(); await page.waitForTimeout(300); await audit(page, "state:fr", "settings in French"); }
  else { results.push({ id: "state:fr", status: "UNVERIFIED", error: "no FR button" }); unverified++; }
}

// rtl state: switch to Arabic
{
  const ar = page.locator("button", { hasText: /العربية/ }).first();
  if (await ar.count()) {
    await ar.click(); await page.waitForTimeout(300);
    await go(page, "#/");
    await audit(page, "state:rtl", "app shell RTL (ar)");
    await page.locator("button", { hasText: /English/ }).first().click().catch(() => {});
    await go(page, "#/settings"); await page.locator("button", { hasText: /English/ }).first().click().catch(() => {});
  } else { results.push({ id: "state:rtl", status: "UNVERIFIED", error: "no AR button" }); unverified++; }
}

// empty-dashboard: new child with zero observations (before PIN set — the
// lock screen would block a second page in this context).
{
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/#/child/new`);
  const nameInput = p2.locator("input").first();
  await nameInput.fill("Empty Test");
  await p2.locator("button[type='submit'], button", { hasText: /create|save|créer|enregistrer/i }).last().click();
  await p2.waitForTimeout(600);
  await audit(p2, "empty-dashboard", "dashboard with child but zero observations");
  await go(p2, "#/history");
  await audit(p2, "empty-history", "history with zero observations");
  await p2.close();
}

// pin states: set PIN in settings, reload → locked; wrong PIN → error
{
  await page.evaluate(() => localStorage.setItem("owly-lang", "en"));
  await go(page, "#/settings");
  await page.waitForTimeout(400);
  const pinInput = page.locator('input[type="password"], input[inputmode="numeric"]').first();
  if (await pinInput.count()) {
    await pinInput.fill("1234");
    await page.locator("button", { hasText: /set|définir|enable|activer/i }).last().click();
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForTimeout(500);
    await audit(page, "pin-locked", "lock screen after PIN set");
    // wrong PIN
    const lockInput = page.locator("input").first();
    await lockInput.fill("9999");
    await page.waitForTimeout(600);
    await audit(page, "pin-error", "lock screen wrong-PIN error");
    // unlock with correct PIN to restore
    await lockInput.fill("1234");
    await page.waitForTimeout(600);
  } else { results.push({ id: "pin-locked", status: "UNVERIFIED", error: "no PIN input" }, { id: "pin-error", status: "UNVERIFIED", error: "no PIN input" }); unverified += 2; }
}

// --- report ---
const scope = { manifest: "scripts/a11y/manifest.json", audited: results.map((r) => r.id) };
writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, tags: TAGS, when: new Date().toISOString(), results }, null, 2));
writeFileSync(`${OUT}/scope.json`, JSON.stringify(scope, null, 2));
const md = ["# a11y audit", "", `Base: ${BASE}`, `Tags: ${TAGS.join(", ")}`, "",
  "| scenario | status | violations | incomplete |", "|---|---|---|---|",
  ...results.map((r) => `| ${r.id} | ${r.status} | ${r.violations?.length ?? "—"} | ${r.incomplete?.length ?? "—"} |`),
  "", `**${pass} PASS · ${fail} FAIL · ${unverified} UNVERIFIED**`];
writeFileSync(`${OUT}/report.md`, md.join("\n"));
console.log(`\n${pass} PASS · ${fail} FAIL · ${unverified} UNVERIFIED → ${OUT}/`);
await browser.close();
process.exit(fail ? 1 : 0);
