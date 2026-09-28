// E2E smoke test — golden path through the PRODUCTION build.
// Usage: npm run build && npx vite preview --port 4173 (in another shell) && node e2e/smoke.mjs
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const nextBtn = () => page.locator("button", { hasText: /next|continuer|suivant/i }).first();

try {
  // 1. Onboarding on fresh install
  await page.goto(BASE + "/#/");
  await page.waitForSelector("body", { timeout: 8000 });
  const onboard = await page.locator("body").innerText();
  ok("onboarding renders", onboard.length > 50);

  // 2. Create a child
  await page.goto(BASE + "/#/child/new");
  await page.waitForSelector("input#name", { timeout: 5000 });
  await page.fill("input#name", "Test Kid");
  await page.fill("input#cond", "CP, non-verbal");
  await page.locator("button.btn-primary").last().click();
  await page.waitForTimeout(800);
  ok("child created → dashboard", /Test Kid/i.test(await page.locator("body").innerText()));

  // 3. Observation wizard: step 0 → next, steps 1-5 pick score 2, 6 → next, 7 → save
  await page.goto(BASE + "/#/observe");
  await page.waitForSelector('[role="status"]', { timeout: 5000 });
  await nextBtn().click();
  for (let s = 0; s < 5; s++) {
    await page.waitForSelector("input[type='radio']", { timeout: 5000 });
    await page.locator("label:has(input[type='radio'])").nth(2).click(); // score 2
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^(next|suivant)$/i.test(x.textContent.trim()));
      return b && !b.disabled;
    }, { timeout: 5000 });
    await nextBtn().click();
  }
  await page.waitForTimeout(400);
  await nextBtn().click(); // step 6 → step 7
  await page.waitForTimeout(300);
  const save = page.locator("button", { hasText: /save|enregistrer/i }).first();
  await save.click();
  await page.waitForTimeout(800);
  ok("observation saved → history", page.url().includes("history") || /history|journal/i.test(await page.locator("body").innerText()));

  // 4. History lists it
  await page.goto(BASE + "/#/history");
  await page.waitForTimeout(500);
  ok("history lists observation", /\d\/10|\d min/.test(await page.locator("body").innerText()));

  // 5. Report page renders
  await page.goto(BASE + "/#/report");
  await page.waitForTimeout(600);
  ok("report page renders", (await page.locator("body").innerText()).length > 100);

  // 6. Settings + language switch
  await page.goto(BASE + "/#/settings");
  await page.waitForTimeout(500);
  ok("settings renders", /settings|réglages|paramètres|data/i.test(await page.locator("body").innerText()));
  const langSel = page.locator("main select").first();
  if (await langSel.count()) {
    await langSel.selectOption("fr");
    await page.waitForTimeout(500);
    ok("french switch", /paramètres|enfant|douleur|supprimer/i.test(await page.locator("body").innerText()));
  } else ok("french switch", false, "no language select");

  // 7. Red flags
  await page.goto(BASE + "/#/redflags");
  await page.waitForTimeout(500);
  ok("red flags renders", /emergency|urgence|911|112|appelez/i.test(await page.locator("body").innerText()));
} catch (e) {
  ok("golden path", false, e.message.split("\n")[0]);
}

ok("no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
