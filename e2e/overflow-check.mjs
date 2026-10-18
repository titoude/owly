// Viewport overflow probe: document scrollWidth must never exceed the
// viewport width on real routes (topnav/child/Emergency must fit).
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const b = await launchBrowser();
let bad = 0;
for (const w of [320, 390, 768, 1024, 1440]) {
  for (const lang of ["en", "de", "ar"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
    const p = await ctx.newPage();
    await p.addInitScript((l) => localStorage.setItem("owly-lang", l), lang);
    // Seed the demo child through the real onboarding control so routes
    // render their actual shell (topnav + child context).
    await p.goto(BASE + "/#/");
    await p.locator("button", { hasText: /demo|démo|عرض/i }).first().click();
    await p.getByText(/^léo$/i).first().waitFor({ timeout: 8000 });
    for (const route of ["/#/", "/#/history", "/#/settings", "/#/report"]) {
      await p.goto(BASE + route);
      await p.waitForTimeout(500);
      const [sw, iw] = await p.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      if (sw > iw) {
        bad++;
        console.log(`OVERFLOW ${w}px ${lang} ${route}: scrollWidth=${sw} > ${iw}`);
      }
    }
    console.log(`${w}px ${lang}: checked 4 routes`);
    await ctx.close();
  }
}
await b.close();
console.log(bad ? `${bad} overflow(s)` : "no overflow");
process.exit(bad ? 1 : 0);
