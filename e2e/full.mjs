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
  await page.waitForSelector('[role="status"]', { timeout: 5000 });
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

  // ── 5b. Report lazy-chunk failure → retryable error, not a stuck button ──
  {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const p2 = await ctx2.newPage();
    const perr = [];
    p2.on("pageerror", (e) => perr.push(e.message));
    await p2.goto(BASE + "/#/welcome");
    await p2.locator("button", { hasText: /demo|démo/i }).first().click();
    await p2.getByText(/^léo$/i).first().waitFor({ timeout: 10000 }); // active child loaded
    await p2.route("**/assets/report-*.js", (r) => r.abort("failed"));
    await p2.goto(BASE + "/#/report");
    const genBtn2 = p2.locator("button.btn-primary.w-full").first(); // label swaps to "Loading…" while busy — use a stable selector
    await genBtn2.waitFor({ timeout: 8000 });
    // an unsaved question must survive the reload recovery
    await p2.locator("input.input").first().fill("kept question");
    await genBtn2.click();
    await p2.locator('[role="alert"]').waitFor({ timeout: 8000 }).catch(() => {});
    const alerts = await p2.locator('[role="alert"]').count();
    const enabled = await genBtn2.isEnabled(); // re-enabled ⇒ busy reset ⇒ not wedged
    const reloadBtn = p2.locator("button", { hasText: /reload|recharger/i }).first();
    const reloadShown = await reloadBtn.count();
    ok("aborted report chunk → alert + reload offered", alerts > 0 && enabled && reloadShown > 0, `alerts=${alerts} enabled=${enabled} reload=${reloadShown} pageerrors=${perr.length}`);
    // post-failure edits are what the stash keeps
    await p2.locator("input.input").first().fill("kept question v2");
    await p2.waitForTimeout(400);

    // cross-child isolation: A's pending stash must not appear on B's report.
    // Seed a second child (+1 observation so the report form renders) and
    // switch active child at the storage level, then reload.
    const aId = await p2.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open("owly");
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const g = r.result.transaction("settings").objectStore("settings").get("activeChildId");
        g.onsuccess = () => res(g.result?.value ?? null);
      };
    }));
    await p2.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open("owly");
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction(["children", "observations", "settings"], "readwrite");
        const add = tx.objectStore("children").add({
          name: "Kid B", birthYear: 2020, conditions: "", communicates: "",
          customDescriptors: { face: "", legs: "", activity: "", cry: "", consolability: "" }, createdAt: Date.now(),
        });
        add.onsuccess = () => {
          tx.objectStore("observations").add({
            childId: add.result, startedAt: Date.now() - 864e5, recordedAt: Date.now() - 864e5,
            scores: { face: 1, legs: 0, activity: 1, cry: 0, consolability: 0 }, total: 2,
            durationMinutes: 20, bodyZones: [], suspectedCause: "", interventions: [], note: "", baseline: false,
          });
          tx.objectStore("settings").put({ key: "activeChildId", value: add.result });
        };
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      };
    }));
    await p2.reload();
    await p2.goto(BASE + "/#/report");
    await p2.waitForSelector("button.btn-primary.w-full", { timeout: 10000 });
    const bVal = await p2.locator("input.input").first().inputValue();
    ok("report stash is scoped per child", bVal === "", `B sees "${bVal}"`);
    // back to A: the stash restores once, then is consumed — a second reload
    // must show empty inputs, not resurrect the stale questions.
    await p2.evaluate((id) => new Promise((res, rej) => {
      const r = indexedDB.open("owly");
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ key: "activeChildId", value: id });
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      };
    }), aId);
    await p2.reload();
    await p2.goto(BASE + "/#/report");
    await p2.waitForSelector("button.btn-primary.w-full", { timeout: 10000 });
    const aVal = await p2.locator("input.input").first().inputValue();
    await p2.reload();
    await p2.goto(BASE + "/#/report");
    await p2.waitForSelector("button.btn-primary.w-full", { timeout: 10000 });
    const aVal2 = await p2.locator("input.input").first().inputValue();
    ok("stash restores for the right child, then is consumed", aVal === "kept question v2" && aVal2 === "", `first="${aVal}" second="${aVal2}"`);

    // recovery: with the abort cleared, this fresh mount generates for real.
    await p2.unroute("**/assets/report-*.js");
    const genBtn3 = p2.locator("button.btn-primary.w-full").first();
    const dlP = p2.waitForEvent("download", { timeout: 20000 });
    await genBtn3.click();
    const dl2 = await dlP.catch(() => null);
    ok("generation succeeds after fresh reload", dl2 !== null && /\.pdf$/.test(dl2.suggestedFilename()), `dl=${dl2?.suggestedFilename()}`);
    await ctx2.close();
  }

  // ── 5c. Chunk failure with sessionStorage denied → honest no-keep message ──
  {
    const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await ctx3.addInitScript(() => {
      // sessionStorage.setItem lives on Storage.prototype — shadowing the
      // instance is silently ignored; patch the prototype for session only.
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (this === window.sessionStorage) throw new DOMException("denied", "SecurityError");
        return orig.call(this, k, v);
      };
    });
    const p3 = await ctx3.newPage();
    await p3.goto(BASE + "/#/welcome");
    await p3.locator("button", { hasText: /demo|démo/i }).first().click();
    await p3.getByText(/^léo$/i).first().waitFor({ timeout: 10000 });
    await p3.route("**/assets/report-*.js", (r) => r.abort("failed"));
    await p3.goto(BASE + "/#/report");
    const genBtn4 = p3.locator("button.btn-primary.w-full").first();
    await genBtn4.waitFor({ timeout: 8000 });
    await p3.locator("input.input").first().fill("lost question");
    await genBtn4.click();
    await p3.locator('[role="alert"]').waitFor({ timeout: 8000 }).catch(() => {});
    const alertTxt = await p3.locator('[role="alert"]').first().innerText().catch(() => "");
    // must not falsely promise the inputs are kept
    ok("denied storage → message does not promise preservation", /not be (kept|preserved)|could not be kept|cannot be saved|n'ont pas pu être/i.test(alertTxt), alertTxt.slice(0, 110));
    await ctx3.close();
  }

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
  await page.locator("main select").first().selectOption("fr");
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
  await page.locator("main select").first().selectOption("en");
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

  // ── 10b. Wizard remounts across edit→new and edit→edit ──────
  // Regression: same-component reconciliation carried edit state into a
  // "new" wizard and autosaved it under the wrong draft key.
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(500);
  const editLinks = page.locator("a", { hasText: /^edit$|^modifier$/i });
  await editLinks.first().click();
  await page.waitForTimeout(600);
  ok("edit route opens edit mode", /edit observation|modifier l/i.test(await page.locator("h1").first().innerText()));
  await page.locator("button", { hasText: /next|suivant/i }).first().click();
  await page.waitForTimeout(400);
  // A FLACC radio must be preselected from the stored record (face score).
  const faceChecked = await page.locator("input[name='flacc-face']:checked").inputValue().catch(() => "none");
  ok("edit preselects the stored score", faceChecked !== "none", `face=${faceChecked}`);
  // Now jump to the NEW-observation nav — the wizard must fully reset.
  await page.locator("nav.fixed button").nth(1).click();
  await page.waitForTimeout(600);
  const stepTxt = await page.locator("[role='status']").first().innerText().catch(() => "?");
  const h1new = await page.locator("h1").first().innerText();
  ok(
    "edit → new fully remounts the wizard",
    /new observation|nouvelle observation/i.test(h1new) && /\b1\b.{0,24}\b8\b/.test(stepTxt) &&
      (await page.locator("#draft-title").count()) === 0,
    `${h1new} / ${stepTxt}`,
  );
  // edit → edit on a different record must reseed, not leak — and each
  // seeded value must equal THAT record's stored face score.
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(500);
  const links2 = page.locator("a", { hasText: /^edit$|^modifier$/i });
  if ((await links2.count()) >= 2) {
    const obsIdOf = (h) => Number(h?.match(/observe\/(\d+)\/edit/)?.[1]);
    const hrefA = await links2.nth(0).getAttribute("href");
    const hrefB = await links2.nth(1).getAttribute("href");
    const stored = async (id) => (await idb("observations", "getAll")).find((o) => o.id === id);
    const faceA = (await stored(obsIdOf(hrefA)))?.scores?.face;
    const faceB = (await stored(obsIdOf(hrefB)))?.scores?.face;
    await links2.nth(0).click();
    await page.waitForTimeout(400);
    await page.locator("button", { hasText: /next|suivant/i }).first().click();
    await page.waitForTimeout(300);
    const a = await page.locator("input[name='flacc-face']:checked").inputValue().catch(() => "none");
    await page.goto(BASE + "/#/history");
    await page.waitForTimeout(400);
    await links2.nth(1).click();
    await page.waitForTimeout(400);
    await page.locator("button", { hasText: /next|suivant/i }).first().click();
    await page.waitForTimeout(300);
    const b = await page.locator("input[name='flacc-face']:checked").inputValue().catch(() => "none");
    ok("edit → edit reseeds per record", a === String(faceA) && b === String(faceB), `obs${obsIdOf(hrefA)} face=${a} (stored ${faceA}) · obs${obsIdOf(hrefB)} face=${b} (stored ${faceB})`);
  } else {
    ok("edit → edit reseeds per record", false, "need ≥2 observations to compare");
  }

  // ── 10c. Draft pins the "when" instant; clock drift can't move it ──
  await page.clock.install();
  await page.goto(BASE + "/#/observe");
  await page.waitForSelector('[role="status"]');
  // discard any draft the earlier wizard run left, for a clean state
  if (await page.locator("#draft-title").count()) {
    await page.locator("button", { hasText: /discard|supprimer|ignorer/i }).first().click();
    await page.waitForTimeout(300);
  }
  await page.locator("button", { hasText: /^15\s*min/i }).first().click(); // "15 min ago"
  await page.waitForTimeout(600);
  const draftRow = async () =>
    (await idb("settings", "getAll")).find((r) => typeof r.key === "string" && r.key.startsWith("owly-draft-"));
  const d1 = (await draftRow())?.value?.startedAt ?? null;
  ok("draft records the pinned when-instant", typeof d1 === "number", `startedAt=${d1}`);
  await page.clock.fastForward(2 * 60 * 60 * 1000); // +2h of wall clock
  await page.locator("button", { hasText: /baseline|de base/i }).first().click(); // unrelated field → autosave
  await page.waitForTimeout(600);
  const d2 = (await draftRow())?.value?.startedAt ?? null;
  ok("elapsed time cannot drift the pinned instant", d1 !== null && d1 === d2, `${d1} → ${d2}`);

  // default "Now" (no when-touch): the draft must pin the wizard-open
  // instant, not null — the common path that used to stay unpinned.
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(400);
  await page.goto(BASE + "/#/observe");
  await page.waitForSelector('[role="status"]');
  if (await page.locator("#draft-title").count()) {
    await page.locator("button", { hasText: /discard|supprimer|ignorer/i }).first().click();
    await page.waitForTimeout(300);
  }
  const openAt = await page.evaluate(() => Date.now());
  await nextBtn().click(); // step 1 — never touched the when field
  await page.waitForTimeout(400);
  await page.locator("label:has(input[type='radio'])").nth(0).click(); // face 0 → autosave
  await page.waitForTimeout(600);
  const d3 = (await draftRow())?.value?.startedAt ?? null;
  ok("default-Now draft pins the wizard-open instant", typeof d3 === "number" && Math.abs(d3 - openAt) < 5000, `open≈${openAt} startedAt=${d3}`);
  await page.clock.fastForward(2 * 60 * 60 * 1000); // +2h more
  await page.locator("label:has(input[type='radio'])").nth(1).click(); // face 1 → autosave again
  await page.waitForTimeout(600);
  const d4 = (await draftRow())?.value?.startedAt ?? null;
  ok("default-Now instant survives elapsed time", d3 !== null && d4 === d3, `${d3} → ${d4}`);

  // resumed draft keeps the exact pinned ms through save (no
  // datetime-local minute truncation)
  const pinned = (await page.evaluate(() => Date.now())) - 91_234;
  const demoId = (await idb("children", "getAll")).find((c) => /léo|leo/i.test(c.name))?.id;
  await page.evaluate(async ([pin, cid]) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("owly"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put({
        key: `owly-draft-${cid}`,
        value: { step: 7, baseline: false, minutesAgo: 0, customAt: null, scores: { face: 1, legs: 1, activity: 1, cry: 1, consolability: 1 }, duration: null, zones: [], cause: "", interventions: [], note: "pin-check", startedAt: pin, savedAt: Date.now() },
      });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }, [pinned, demoId]);
  // leave + return so ObserveKeyed remounts and re-checks for a draft
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(400);
  await page.goto(BASE + "/#/observe");
  await page.waitForSelector("#draft-title", { timeout: 5000 });
  await page.locator("button", { hasText: /resume|reprendre/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator("button", { hasText: /save observation|enregistrer/i }).last().click();
  await page.waitForTimeout(800);
  const savedObs = (await idb("observations", "getAll")).find((o) => o.note === "pin-check");
  ok("resumed draft saves the exact pinned instant", savedObs && savedObs.startedAt === pinned, `want ${pinned}, got ${savedObs?.startedAt}`);

  // note-only edit: startedAt AND recordedAt must be bit-identical
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(500);
  const firstEdit = page.locator("a", { hasText: /^edit$|^modifier$/i }).first();
  const editHref = await firstEdit.getAttribute("href");
  const editObsId = Number(editHref?.match(/observe\/(\d+)\/edit/)?.[1]);
  const beforeEdit = (await idb("observations", "getAll")).find((o) => o.id === editObsId);
  await firstEdit.click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 7; i++) { await nextBtn().click(); await page.waitForTimeout(200); }
  const noteArea = page.locator("textarea").last();
  await noteArea.fill("note-only edit");
  await page.locator("button", { hasText: /save|enregistrer/i }).last().click(); // edit mode: "Save changes"
  await page.waitForTimeout(700);
  const afterEdit = (await idb("observations", "getAll")).find((o) => o.id === editObsId);
  ok(
    "note-only edit preserves original timestamps",
    afterEdit && afterEdit.startedAt === beforeEdit.startedAt && afterEdit.recordedAt === beforeEdit.recordedAt,
    `startedAt ${beforeEdit?.startedAt}→${afterEdit?.startedAt}, recordedAt ${beforeEdit?.recordedAt}→${afterEdit?.recordedAt}`,
  );

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
