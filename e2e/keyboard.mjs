// Keyboard-only E2E — real key events against the production build.
// Usage: npm run build && npx vite preview --port 4173 && node e2e/keyboard.mjs
import { launchBrowser } from "./browser.mjs";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await launchBrowser();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const focused = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, type: el?.type, value: el?.value, checked: el?.checked };
  });
const checkedValue = () =>
  page.evaluate(
    () => document.querySelector("input[name='flacc-face']:checked")?.value ?? null,
  );

// ── Radio group: arrows, wrap, space, roving tab ─────────────
// Seed demo data first (observe needs an active child)
await page.goto(BASE + "/#/");
await page.waitForSelector("body", { timeout: 8000 });
await page.locator("button", { hasText: /demo|démo/i }).first().click();
await page.waitForTimeout(1200);
await page.goto(BASE + "/#/observe");
await page.waitForSelector("text=/[0-9]\/[0-9]/", { timeout: 8000 });
await page.locator("button", { hasText: /next|continuer|suivant/i }).last().click();
await page.waitForSelector("input[name='flacc-face']", { timeout: 8000 });

await page.locator("input[name='flacc-face'][value='0']").focus();
let f = await focused();
ok("radio 0 takes focus", f.type === "radio" && f.value === "0", JSON.stringify(f));
ok("focus does not change selection", (await checkedValue()) === null || (await checkedValue()) === "0");

await page.keyboard.press("ArrowDown");
f = await focused();
ok("ArrowDown moves focus+selection 0→1", f.value === "1" && f.checked === true, JSON.stringify(f));
ok("selection persisted to radio group", (await checkedValue()) === "1");

await page.keyboard.press("ArrowDown");
ok("ArrowDown 1→2", (await focused()).value === "2" && (await checkedValue()) === "2");
await page.keyboard.press("ArrowDown"); // →0 (wrap, 3 items)
f = await focused();
ok("ArrowDown wraps 2→0", f.value === "0" && f.checked === true, JSON.stringify(f));
await page.keyboard.press("ArrowUp"); // wraps back up →2
f = await focused();
ok("ArrowUp wraps 0→2", f.value === "2" && f.checked === true, JSON.stringify(f));

// Roving tab, real CUA path: focus is on the CHECKED radio (2) after the
// wrap test. Tab must leave the whole group (not stop on radios 0/1);
// Shift+Tab from the next control must return to the checked radio.
f = await focused();
ok("precondition: focus on checked radio 2", f.type === "radio" && f.value === "2" && f.checked === true, JSON.stringify(f));
await page.keyboard.press("Tab");
f = await focused();
ok("Tab exits the radio group", !(f.type === "radio" && ["0", "1", "2"].includes(f.value)), JSON.stringify(f));
await page.keyboard.press("Shift+Tab");
f = await focused();
ok("Shift+Tab re-enters group on checked radio (2)", f.type === "radio" && f.value === "2" && f.checked === true, JSON.stringify(f));

// ── Bottom nav reachable by keyboard ─────────────────────────
await page.evaluate(() => document.activeElement?.blur());
for (let i = 0; i < 25 && !(await focused()).tag?.match(/A|BUTTON/); i++) {
  await page.keyboard.press("Tab");
}
f = await focused();
ok("Tab reaches an interactive element", /A|BUTTON/.test(f.tag ?? ""), JSON.stringify(f));

// ── Skip-to-content link ───────────────────────────────────
// Full reload (not a hash change): sequential focus starts at document top,
// which is what a real keyboard user's first Tab sees.
await page.goto(BASE);
await page.waitForSelector("nav", { timeout: 8000 });
await page.keyboard.press("Tab");
const fSkip = await page.evaluate(() => ({
  tag: document.activeElement?.tagName,
  href: document.activeElement?.getAttribute("href"),
  text: document.activeElement?.textContent?.trim(),
}));
ok("first Tab stop is the skip link", fSkip.tag === "A" && fSkip.href === "#main", JSON.stringify(fSkip));
await page.keyboard.press("Enter");
const fMain = await page.evaluate(() => document.activeElement?.id);
ok("skip link moves focus to main content", fMain === "main", `active=${fMain}`);

// ── Import preview dialog: focus entry / containment / Escape / restore ──
writeFileSync(
  "/tmp/owly-kb-import.json",
  JSON.stringify({
    version: 1,
    children: [{ id: 7, name: "KB Test", createdAt: 1700000000000, birthYear: 2020, conditions: "", communicates: "", customDescriptors: {} }],
    observations: [],
  }),
);
await page.goto(BASE + "/#/settings");
await page.waitForSelector('input[type="file"]', { state: "attached", timeout: 8000 });
const importBtn = page.locator("button", { hasText: /import|importer/i }).first();
await importBtn.click(); // focuses the trigger (dialog restores here)
await page.locator('input[type="file"]').setInputFiles("/tmp/owly-kb-import.json");
await page.waitForSelector("dialog[open]", { timeout: 8000 });
const inDlg = await page.evaluate(() => {
  const dlg = document.querySelector("dialog[open]");
  return { inDialog: !!dlg && dlg.contains(document.activeElement), active: document.activeElement?.tagName + "." + (document.activeElement?.textContent?.trim().slice(0, 16) ?? "") };
});
ok("dialog opens with focus inside", inDlg.inDialog, inDlg.active);
// Native modal containment: Tab must never land on a focusable element in the
// inert background. Chrome's own chrome-frame wrap slot reports BODY — allowed.
let leaked = null;
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("Tab");
  const where = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body-wrap";
    const dlg = document.querySelector("dialog[open]");
    return dlg && dlg.contains(el) ? "in" : `OUT:${el.tagName}.${el.textContent?.trim().slice(0, 30)}`;
  });
  if (where !== "in" && where !== "body-wrap") { leaked = where; break; }
}
ok("Tab never reaches background controls", leaked === null, leaked ?? "cycled inside dialog + browser wrap");
await page.keyboard.press("Escape");
const dlgGone = await page.evaluate(() => !document.querySelector("dialog[open]"));
const restore = await page.evaluate(() => ({
  tag: document.activeElement?.tagName,
  txt: document.activeElement?.textContent?.trim().slice(0, 30) ?? "",
}));
ok("Escape dismisses and restores focus to the trigger", dlgGone && restore.tag === "BUTTON" && /import|importer/i.test(restore.txt), `focus=${restore.tag}.${restore.txt}`);
// data invariant: cancelled import must leave children untouched
const childNames = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("owly"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const names = await new Promise((res, rej) => { const tx = db.transaction("children"); const q = tx.objectStore("children").getAll(); q.onsuccess = () => res(q.result.map((c) => c.name)); q.onerror = () => rej(q.error); });
  return names;
});
ok("cancelled import preserved existing data", !childNames.includes("KB Test"), JSON.stringify(childNames));

await browser.close();
const failed = results.filter((r) => !r.pass);
if (errors.length) { console.log("JS errors:", errors); failed.push({ name: "no js errors", pass: false }); }
console.log(`\n${results.length - failed.length}/${results.length} keyboard checks passed`);
process.exit(failed.length ? 1 : 0);
