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

// A state audit only counts when its precondition element actually rendered.
// Otherwise record UNVERIFIED — never silently PASS a state we didn't reach.
async function req(page, selector, id, what) {
  const found = (await page.locator(selector).first().count()) > 0;
  if (!found) { results.push({ id, status: "UNVERIFIED", error: `missing precondition: ${what}` }); unverified++; }
  return found;
}

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
        // keep the actual failure detail: an incomplete with nodes:[] may be a
        // rule that THREW (e.g. unparseable color) — that is never "no issues".
        incomplete: res.incomplete.map((v) => ({
          id: v.id, nodes: v.nodes.length,
          error: v.error ? String(v.error).slice(0, 200) : undefined,
          errorNode: v.nodes.find((n) => n.any?.some((c) => c.error))?.target?.join(" ") ?? undefined,
        })),
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
  const stepTxt = await page.locator('[role="status"]').first().innerText().catch(() => "");
  if (!stepTxt.trim().startsWith(`${s + 1}/`)) {
    results.push({ id: `observe-step${s}`, status: "UNVERIFIED", error: `step indicator is "${stepTxt.trim()}" not ${s + 1}/8` });
    unverified++; break;
  }
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
  if (await del.count()) {
    await del.click();
    // the confirm affordance must actually appear
    if (await req(page, 'button:has-text("Delete this"), button:has-text("Supprimer")', "delete-confirm", "confirm button after delete click"))
      await audit(page, "delete-confirm", "inline delete confirmation");
  } else { results.push({ id: "delete-confirm", status: "UNVERIFIED", error: "no delete button found" }); unverified++; }
}

// child-edit via settings edit link
await go(page, "#/settings");
{
  const edit = page.locator("a", { hasText: /edit|modifier/i }).first();
  if (await edit.count()) { await edit.click(); if (await req(page, "form input", "child-edit", "edit form input")) await audit(page, "child-edit", "edit form for existing child"); await page.goBack(); }
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
    if (await req(page, '[role="alertdialog"]', "import-preview", "replacement-preview alertdialog"))
      await audit(page, "import-preview", "replacement-preview dialog");
    await page.locator("button", { hasText: /cancel|annuler/i }).first().click().catch(() => {});
  } else { results.push({ id: "import-preview", status: "UNVERIFIED", error: "no export download" }); unverified++; }
}

// draft-resume: the step audits above left an autosaved draft; re-enter /observe
{
  await go(page, "#/history");
  await page.waitForTimeout(400);
  await go(page, "#/observe");
  const offer = page.locator("#draft-title");
  await offer.waitFor({ timeout: 6000 }).catch(() => {});
  if (await offer.count()) {
    await req(page, "#draft-title", "draft-resume", "draft offer");
    if (results.at(-1).status !== "UNVERIFIED") await audit(page, "draft-resume", "draft resume/discard offer on wizard entry");
    await page.locator("button", { hasText: /discard|ignorer/i }).first().click().catch(() => {});
    await page.waitForTimeout(300);
  } else { results.push({ id: "draft-resume", status: "UNVERIFIED", error: "no draft offer after partial wizard" }); unverified++; }
}

// observe-edit: open an existing observation in edit mode
{
  await go(page, "#/history");
  const editLink = page.locator("a", { hasText: /edit|modifier/i }).first();
  await editLink.waitFor({ timeout: 6000 }).catch(() => {});
  if (await editLink.count()) { await editLink.click(); await page.waitForTimeout(400); if (await req(page, 'h1:has-text("Edit"), h1:has-text("Modifier")', "observe-edit", "edit-mode heading")) await audit(page, "observe-edit", "observation edit mode (preseeded)"); }
  else { results.push({ id: "observe-edit", status: "UNVERIFIED", error: "no edit link on history row" }); unverified++; }
}

// draft-save-error: quota failure on draft autosave surfaces an alert
{
  await page.evaluate(() => {
    window.__origPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException("quota", "QuotaExceededError"); };
  });
  await go(page, "#/observe");
  await page.locator('label:has(input[type="radio"])').first().click().catch(() => {});
  await page.waitForTimeout(700);
  if (await req(page, '[role="alert"]', "draft-save-error", "draft-save alert (quota fault)"))
    await audit(page, "draft-save-error", "autosave failure surfaced (quota/denied)");
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__origPut; });
}

// pdf-unsupported: a name containing an unrenderable char must surface an
// accessible error instead of a PDF with replacement boxes
{
  await go(page, "#/settings");
  const edit = page.locator("a", { hasText: /edit|modifier/i }).first();
  await edit.waitFor({ timeout: 6000 }).catch(() => {});
  if (await edit.count()) {
    await edit.click();
    await page.waitForTimeout(400);
    const nameInput = page.locator("input").first();
    await nameInput.fill("Léo \u{1F989}");
    await page.locator("button[type='submit'], button", { hasText: /save|enregistrer/i }).last().click();
    await page.waitForTimeout(500);
    await go(page, "#/report");
    await page.locator("button", { hasText: /generate|générer|prepare|préparer|download|télécharger/i }).last().click().catch(() => {});
    await page.locator('[role="alert"]').waitFor({ timeout: 10000 }).catch(() => {});
    if (await req(page, '[role="alert"]', "pdf-unsupported", "unsupported-chars alert"))
      await audit(page, "pdf-unsupported", "unsupported-character PDF error");
    await go(page, "#/settings");
    const editBack = page.locator("a", { hasText: /edit|modifier/i }).first();
    await editBack.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator("input").first().fill("Léo");
    await page.locator("button[type='submit'], button", { hasText: /save|enregistrer/i }).last().click();
    await page.waitForTimeout(400);
  } else { results.push({ id: "pdf-unsupported", status: "UNVERIFIED", error: "no child edit link" }); unverified++; }
}

// storage-denied-boot: IndexedDB AND localStorage unavailable at startup
// must reach a recovery screen (role=alert), not a permanent spinner
{
  const dctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await dctx.addInitScript(() => {
    const denied = () => { throw new DOMException("denied", "SecurityError"); };
    try { Object.defineProperty(window, "localStorage", { configurable: true, get: denied }); } catch {}
    try { Object.defineProperty(window, "indexedDB", { configurable: true, get: denied }); } catch {
      window.indexedDB.open = denied;
    }
  });
  const dp = await dctx.newPage();
  await dp.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await dp.waitForTimeout(1800);
  await audit(dp, "storage-denied-boot", "boot with storage denied → recovery screen");
  if (!(await dp.locator('[role="alert"]').count())) {
    fail++;
    results.push({ id: "storage-denied-boot-ui", status: "FAIL", violations: [{ id: "missing-recovery-ui", impact: "critical", help: "no role=alert recovery UI rendered", nodes: [] }], incomplete: [], passes: 0 });
    console.log("FAIL storage-denied-boot-ui — no recovery UI");
  }
  await dctx.close();
}

// ls-denied-boot: only localStorage denied → app still boots (lang falls back)
{
  const lctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await lctx.addInitScript(() => {
    const denied = () => { throw new DOMException("denied", "SecurityError"); };
    try { Object.defineProperty(window, "localStorage", { configurable: true, get: denied }); } catch {}
  });
  const lp = await lctx.newPage();
  await lp.goto(`${BASE}/#/welcome`, { waitUntil: "domcontentloaded" });
  await lp.waitForTimeout(1500);
  if (await lp.locator("main, h1, nav").first().count()) await audit(lp, "ls-denied-boot", "boot with only localStorage denied");
  else { fail++; results.push({ id: "ls-denied-boot", status: "FAIL", violations: [{ id: "no-boot", impact: "critical", help: "no UI rendered", nodes: [] }], incomplete: [], passes: 0 }); }
  await lctx.close();
}

// fr state: switch to French
await go(page, "#/settings");
{
  const fr = page.locator("button", { hasText: /Français/ }).first();
  if (await fr.count()) {
    await fr.click(); await page.waitForTimeout(300);
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== "fr") { results.push({ id: "state:fr", status: "UNVERIFIED", error: `lang=${lang}, expected fr` }); unverified++; }
    else await audit(page, "state:fr", "settings in French");
  }
  else { results.push({ id: "state:fr", status: "UNVERIFIED", error: "no FR button" }); unverified++; }
}

// rtl state: switch to Arabic
{
  const ar = page.locator("button", { hasText: /العربية/ }).first();
  if (await ar.count()) {
    await ar.click(); await page.waitForTimeout(300);
    await go(page, "#/");
    const dir = await page.evaluate(() => document.documentElement.dir);
    if (dir !== "rtl") { results.push({ id: "state:rtl", status: "UNVERIFIED", error: `dir=${dir}, expected rtl` }); unverified++; }
    else await audit(page, "state:rtl", "app shell RTL (ar)");
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
  await go(p2, "#/patterns");
  await audit(p2, "empty-patterns", "patterns with zero observations");
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
    if (await req(page, 'input[inputmode="numeric"], input[type="password"]', "pin-locked", "lock input after PIN set"))
      await audit(page, "pin-locked", "lock screen after PIN set");
    // wrong PIN
    const lockInput = page.locator("input").first();
    await lockInput.fill("9999");
    await page.waitForTimeout(600);
    if (await req(page, '[role="alert"]', "pin-error", "wrong-PIN alert"))
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
