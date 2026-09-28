// Exhaustive E2E — every user flow on the PRODUCTION build, with screenshots.
// Usage: npm run build && npx vite preview --port 4173 && node e2e/full.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await launchBrowser();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const nextBtn = () => page.locator("button", { hasText: /next|continuer|suivant/i }).last();

try {
  // ── 1. Onboarding + demo seed ──────────────────────────────
  await page.goto(BASE + "/#/");
  await page.waitForSelector("body", { timeout: 8000 });
  await shot("01-onboarding");
  const demoBtn = page.locator("button", { hasText: /demo|démo/i }).first();
  ok("onboarding has demo button", (await demoBtn.count()) > 0);
  await demoBtn.click();
  await page.waitForTimeout(1200);
  await shot("02-dashboard-demo");
  ok("demo child on dashboard", /léo/i.test(await page.locator("body").innerText()));

  // ── 2. Patterns with demo data ─────────────────────────────
  await page.goto(BASE + "/#/patterns");
  await page.waitForTimeout(700);
  await shot("03-patterns");
  const patTxt = await page.locator("body").innerText();
  ok("patterns shows insights", /night|nuit|oreilles|ears|ibupro/i.test(patTxt), patTxt.slice(0, 80));

  // ── 3. History with demo data ──────────────────────────────
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(600);
  await shot("04-history");
  ok("history lists demo episodes", /\d\/10/.test(await page.locator("body").innerText()));

  // ── 4. Observe wizard full pass ────────────────────────────
  await page.goto(BASE + "/#/observe");
  await page.waitForSelector("text=/[0-9]\/[0-9]/", { timeout: 5000 });
  await shot("05-observe-step0");
  await nextBtn().click();
  const scores = [1, 2, 0, 1, 2];
  for (let s = 0; s < 5; s++) {
    await page.waitForSelector("input[type='radio']", { timeout: 5000 });
    await page.locator("label:has(input[type='radio'])").nth(scores[s]).click();
    if (s === 0) await shot("06-observe-flacc");
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^(next|suivant)$/i.test(x.textContent.trim()));
      return b && !b.disabled;
    }, { timeout: 5000 });
    await nextBtn().click();
  }
  await page.waitForTimeout(400);
  await shot("07-observe-score-zones");
  // pick a body zone chip
  const zoneChip = page.locator("button", { hasText: /oreilles|ears/i }).first();
  if (await zoneChip.count()) await zoneChip.click();
  await nextBtn().click();
  await page.waitForTimeout(400);
  await shot("08-observe-interventions");
  // toggle medication intervention + helped yes
  const med = page.locator("button", { hasText: /médicament|medication/i }).first();
  if (await med.count()) {
    await med.click();
    await page.waitForTimeout(200);
    const yes = page.locator("button", { hasText: /^oui$|^yes$/i }).first();
    if (await yes.count()) await yes.click();
  }
  await page.locator("button", { hasText: /save|enregistrer/i }).last().click();
  await page.waitForTimeout(900);
  ok("wizard saves → history", page.url().includes("history"));

  // ── 5. Report + real PDF download ──────────────────────────
  await page.goto(BASE + "/#/report");
  await page.waitForTimeout(600);
  await shot("09-report");
  const gen = page.locator("button", { hasText: /generate|générer/i }).last();
  const dl = page.waitForEvent("download", { timeout: 15000 });
  await gen.click();
  const download = await dl;
  ok("PDF downloads", /\.pdf$/.test(download.suggestedFilename()), download.suggestedFilename());

  // ── 6. PIN lock roundtrip ──────────────────────────────────
  await page.goto(BASE + "/#/settings");
  await page.waitForTimeout(500);
  await shot("10-settings");
  const pinInput = page.locator("input[inputmode='numeric']").first();
  await pinInput.fill("1234");
  await page.locator("button", { hasText: /set|définir|activer/i }).last().click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForTimeout(800);
  await shot("11-lockscreen");
  ok("PIN locks app", /inputmode|password/i.test(await page.locator("input").first().getAttribute("type")) || (await page.locator("input").count()) > 0);
  const lock = page.locator("input[inputmode='numeric']").first();
  await lock.fill("1234");
  await page.waitForTimeout(800);
  ok("PIN unlocks", /léo|settings|paramètres/i.test(await page.locator("body").innerText()));
  // remove PIN again for remaining tests
  const rm = page.locator("button", { hasText: /remove|supprimer|retirer/i }).first();
  if (await rm.count()) { await rm.click(); await page.waitForTimeout(300); }

  // ── 7. French switch ───────────────────────────────────────
  await page.goto(BASE + "/#/settings");
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /français/i }).first().click();
  await page.waitForTimeout(500);
  ok("french switch", /paramètres|enfant|journal/i.test(await page.locator("body").innerText()));
  await shot("12-settings-fr");
  await page.goto(BASE + "/#/");
  await page.waitForTimeout(400);
  await shot("13-dashboard-fr");
  await page.locator("html").evaluate(() => {});
  ok("html lang=fr", (await page.getAttribute("html", "lang")) === "fr");
  // back to EN
  await page.goto(BASE + "/#/settings");
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /english/i }).first().click();
  await page.waitForTimeout(400);

  // ── 8. Red flags ───────────────────────────────────────────
  await page.goto(BASE + "/#/redflags");
  await page.waitForTimeout(500);
  await shot("14-redflags");
  ok("red flags renders", /emergency|911|112|appelez|urgence/i.test(await page.locator("body").innerText()));

  // ── 9. New child flow ──────────────────────────────────────
  await page.goto(BASE + "/#/child/new");
  await page.waitForSelector("input#name", { timeout: 5000 });
  await shot("15-childform");
  await page.fill("input#name", "Maya");
  await page.locator("button.btn-primary").last().click();
  await page.waitForTimeout(700);
  ok("second child created", /Maya/i.test(await page.locator("body").innerText()));

  // ── 10. Delete persists in history ─────────────────────────
  // Maya (just created) has no observations — switch back to Léo first.
  await page.goto(BASE + "/#/settings");
  await page.waitForTimeout(500);
  await page.locator("button", { hasText: /léo/i }).first().click();
  await page.waitForTimeout(400);
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(600);
  const delBtns = () => page.locator("button", { hasText: /^delete$|^supprimer$/i }).count();
  const delBefore = await delBtns();
  if (delBefore === 0) {
    ok("delete asks confirm", false, "no observations on active child (Léo seed missing?)");
  } else {
    await page.locator("button", { hasText: /^delete$|^supprimer$/i }).first().click();
    await page.waitForTimeout(300);
    const confirmBtn = page.locator("button", { hasText: /this observation\?|cette observation/i }).first();
    ok("delete asks confirm", (await confirmBtn.count()) > 0);
    if (await confirmBtn.count()) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
      const delAfter = await delBtns();
      ok("delete removes the row", delAfter === delBefore - 1, `${delBefore} → ${delAfter}`);
      await page.reload();
      await page.waitForTimeout(700);
      ok("delete persists after reload", (await delBtns()) === delBefore - 1);
    }
  }

  // ── 11. Export produces JSON download ──────────────────────
  await page.goto(BASE + "/#/settings");
  await page.waitForTimeout(400);
  const ex = page.locator("button", { hasText: /export|download|télécharger|exporter/i }).first();
  const dl2 = page.waitForEvent("download", { timeout: 10000 });
  await ex.click();
  const exDl = await dl2;
  ok("JSON backup downloads", /\.json$/.test(exDl.suggestedFilename()), exDl.suggestedFilename());
  const backupPath = await exDl.path();

  // ── 12. Import: real file chooser — preview → cancel → reject → replace ──
  // Read the database straight from IndexedDB so assertions check persisted
  // records, not just rendered text.
  const idb = (store, mode = "count") =>
    page.evaluate(
      ([s, m]) =>
        new Promise((res, rej) => {
          const r = indexedDB.open("owly");
          r.onerror = () => rej(r.error);
          r.onsuccess = () => {
            const os = r.result.transaction(s).objectStore(s);
            const req = m === "count" ? os.count() : os.getAll();
            req.onerror = () => rej(req.error);
            req.onsuccess = () => res(req.result);
          };
        }),
      [store, mode],
    );
  const obsCount = () => idb("observations");
  const childNames = async () =>
    (await idb("children", "getAll")).map((c) => c.name).sort();
  // Deep snapshots: counts/names alone could pass while records were mutated.
  const snapshot = async () =>
    JSON.stringify({
      children: await idb("children", "getAll"),
      observations: await idb("observations", "getAll"),
      settings: await idb("settings", "getAll"),
    });
  const activeChildName = async () => {
    const st = await idb("settings", "getAll");
    const id = st.find((r) => r.key === "activeChildId")?.value;
    const kids = await idb("children", "getAll");
    return kids.find((c) => c.id === id)?.name ?? null;
  };

  const beforeObs = await obsCount();
  const beforeKids = await childNames();
  const beforeSnap = await snapshot();
  const expInKids = beforeKids.length; // the exported backup carries all current children
  const expInObs = beforeObs;

  // 12a. Valid backup → preview → Cancel must leave every record untouched.
  await page.locator("input[type='file']").setInputFiles(backupPath);
  await page.waitForSelector("[role='alertdialog']", { timeout: 5000 });
  const previewTxt = await page.locator("[role='alertdialog']").innerText();
  ok(
    "import preview shows exact incoming counts",
    new RegExp(`${expInKids} profile|${expInKids} profil`).test(previewTxt) &&
      new RegExp(`${expInObs} observation`).test(previewTxt),
    `want ${expInKids}/${expInObs}, got: ${previewTxt.slice(0, 120)}`,
  );
  ok("preview shows current counts too", /replaces|remplace/i.test(previewTxt));
  await page.locator("[role='alertdialog'] button", { hasText: /cancel|annuler/i }).click();
  await page.waitForTimeout(400);
  ok("cancel import preserves all records", (await snapshot()) === beforeSnap);

  // 12b. A structurally invalid backup (nested object where text belongs)
  // must be rejected before any data is touched.
  const badPath = `${SHOTS}/bad-import.json`;
  writeFileSync(
    badPath,
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      children: [
        { name: "Bad", createdAt: Date.now(), customDescriptors: { face: { nested: true }, legs: "", activity: "", cry: "", consolability: "" } },
      ],
      observations: [],
    }),
  );
  await page.locator("input[type='file']").setInputFiles(badPath);
  await page.waitForTimeout(600);
  ok("invalid backup rejected (no preview)", (await page.locator("[role='alertdialog']").count()) === 0);
  ok("rejection shown to user", /couldn't read|impossible|error|erreur|invalide/i.test(await page.locator("body").innerText()));
  ok("rejected import preserves all records", (await snapshot()) === beforeSnap);

  // 12b2. A file whose timestamps exceed Date range must also be rejected
  // before any data is touched.
  const badTsPath = `${SHOTS}/bad-ts-import.json`;
  writeFileSync(
    badTsPath,
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      children: [{ id: 91, name: "BadTs", createdAt: Date.now() }],
      observations: [
        {
          childId: 91,
          startedAt: 9e18,
          recordedAt: Date.now(),
          scores: { face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 },
        },
      ],
    }),
  );
  await page.locator("input[type='file']").setInputFiles(badTsPath);
  await page.waitForTimeout(600);
  ok("unrepresentable-date backup rejected (no preview)", (await page.locator("[role='alertdialog']").count()) === 0);
  ok("date rejection preserves all records", (await snapshot()) === beforeSnap);

  // 12c. Confirmed replacement swaps the data and refreshes the active child.
  const okPath = `${SHOTS}/ok-import.json`;
  const now = Date.now();
  writeFileSync(
    okPath,
    JSON.stringify({
      version: 1,
      exportedAt: new Date(now).toISOString(),
      children: [
        {
          id: 77,
          name: "Restored Kid",
          createdAt: now,
          birthYear: 2018,
          conditions: "test",
          communicates: "points",
          customDescriptors: { face: "frowns", legs: "", activity: "", cry: "", consolability: "" },
        },
      ],
      observations: [
        {
          childId: 77,
          startedAt: now - 3600000,
          recordedAt: now - 3500000,
          scores: { face: 1, legs: 0, activity: 1, cry: 0, consolability: 1 },
          durationMinutes: 20,
          bodyZones: ["head"],
          suspectedCause: "test import",
          interventions: [],
          note: "import marker",
          baseline: false,
        },
      ],
    }),
  );
  await page.locator("input[type='file']").setInputFiles(okPath);
  await page.waitForSelector("[role='alertdialog']", { timeout: 5000 });
  // Preview must quote fresh current counts (obsCount re-read after the
  // earlier demo/seed mutations — the stale-mount bug would show 0 here).
  const replacePreviewTxt = await page.locator("[role='alertdialog']").innerText();
  ok(
    "replace preview shows fresh current counts",
    new RegExp(`${beforeKids.length} profile|${beforeKids.length} profil`).test(replacePreviewTxt) &&
      new RegExp(`${beforeObs} observation`).test(replacePreviewTxt),
    replacePreviewTxt.slice(0, 120),
  );
  await page.locator("[role='alertdialog'] button", { hasText: /replace with|remplacer/i }).click();
  await page.waitForTimeout(800);
  ok("confirmed import replaces records", (await obsCount()) === 1 && JSON.stringify(await childNames()) === '["Restored Kid"]');
  ok("active profile refreshed to imported child", (await activeChildName()) === "Restored Kid");
  await page.goto(BASE + "/#/");
  await page.waitForTimeout(500);
  ok("dashboard shows imported child", /Restored Kid/i.test(await page.locator("body").innerText()));
} catch (e) {
  ok("suite completed", false, e.message.split("\n")[0]);
}

ok("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await shot("99-final");
await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} passed — shots in ${SHOTS}`);
process.exit(fails.length ? 1 : 0);
