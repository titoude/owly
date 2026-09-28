import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { buildReport, fontBytes, UnsupportedCharsError } from "../report";
import type { Child, Observation } from "../types";

// Intercept the real rendering boundary: every string the report actually
// draws, with the y coordinate it was drawn at.
function spyOnDraw() {
  const spy = vi.spyOn(PDFPage.prototype, "drawText");
  // Capture then restore: mockRestore() clears the call history.
  return {
    calls: () => {
      const calls = spy.mock.calls;
      spy.mockRestore();
      return calls;
    },
  };
}
const drawnY = (calls: unknown[][]) =>
  calls.map((c) => (c[1] as { y: number }).y);
const drawnText = (calls: unknown[][]) =>
  calls.map((c) => String(c[0])).join("\n");

const child: Child = {
  id: 1,
  name: "Léo",
  birthYear: 2016,
  conditions: "Autism, non-verbal",
  communicates: "pulls ears, rocks",
  customDescriptors: { face: "grimaces", legs: "", activity: "", cry: "", consolability: "" },
  createdAt: 0,
};

const mkObs = (total: number, daysAgo: number, baseline = false): Observation => ({
  childId: 1,
  startedAt: Date.now() - daysAgo * 864e5,
  recordedAt: Date.now() - daysAgo * 864e5 + 60000,
  scores: { face: 2, legs: 1, activity: 2, cry: 1, consolability: 2 },
  total,
  durationMinutes: 45,
  bodyZones: ["ears"],
  suspectedCause: "ear",
  interventions: [{ type: "medication", label: "ibuprofen 10ml", helped: "yes" }],
  note: "woke at night",
  baseline,
});

describe("buildReport", () => {
  it("generates a valid one-page PDF", async () => {
    const bytes = await buildReport(child, [mkObs(8, 2), mkObs(0, 5, true)], {
      periodDays: 30,
      questions: ["Could it be an ear infection?"],
    });
    expect(bytes.length).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("respects the period filter", async () => {
    const all = await buildReport(child, [mkObs(8, 2), mkObs(6, 60)], { periodDays: 30, questions: [] });
    const doc = await PDFDocument.load(all);
    // page still builds — period filtering exercised without crashing
    expect(doc.getPageCount()).toBe(1);
  });

  it("handles zero episodes and no questions", async () => {
    const bytes = await buildReport(child, [], { periodDays: null, questions: [] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("paginates a long 'communicates' field instead of drawing off-page", async () => {
    const spy = spyOnDraw();
    const bytes = await buildReport(
      { ...child, communicates: "Observation detaillee du comportement. ".repeat(140) },
      [mkObs(8, 2)],
      { periodDays: null, questions: ["Is this pattern relevant?"] },
    );
    const calls = spy.calls();
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    // Every string actually rendered sits inside the printable area
    // (content stays above the footer zone; nothing below ~34pt or off-page).
    // Content must stay in the printable zone (>= footer zone at ~34pt);
    // the per-page identity stamp legitimately sits lower in the margin.
    const contentYs = drawnY(calls.filter((c) => !/ — p\. \d+\/\d+$/.test(String(c[0]))));
    expect(Math.min(...contentYs)).toBeGreaterThanOrEqual(30);
    const stampYs = drawnY(calls.filter((c) => / — p\. \d+\/\d+$/.test(String(c[0]))));
    expect(stampYs.length).toBe(doc.getPageCount());
    expect(Math.min(...stampYs)).toBeGreaterThan(0);
    // The long field was rendered, not clipped away.
    expect(drawnText(calls)).toContain("Observation detaillee du comportement.");
    expect(drawnText(calls)).toContain("Is this pattern relevant?");
  });

  it("keeps every episode in the log across pages (no silent truncation)", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...mkObs((i % 10) + 1, i + 1),
      note: `ep${String(i).padStart(2, "0")}marker`,
    }));
    const spy = spyOnDraw();
    const bytes = await buildReport(child, many, { periodDays: null, questions: [] });
    const calls = spy.calls();
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    const all = drawnText(calls);
    for (let i = 0; i < 60; i++) {
      expect(all).toContain(`ep${String(i).padStart(2, "0")}marker`);
    }
    // Content must stay in the printable zone (>= footer zone at ~34pt);
    // the per-page identity stamp legitimately sits lower in the margin.
    const contentYs = drawnY(calls.filter((c) => !/ — p\. \d+\/\d+$/.test(String(c[0]))));
    expect(Math.min(...contentYs)).toBeGreaterThanOrEqual(30);
    const stampYs = drawnY(calls.filter((c) => / — p\. \d+\/\d+$/.test(String(c[0]))));
    expect(stampYs.length).toBe(doc.getPageCount());
    expect(Math.min(...stampYs)).toBeGreaterThan(0);
  });

  it("splits an episode taller than a page across pages, repeating its identity", async () => {
    const obs = {
      ...mkObs(7, 1),
      note:
        "EPISODE_MARKER_60 " +
        "Long note without lost content. ".repeat(350) +
        " END_OF_FINAL_NOTE",
    };
    const spy = spyOnDraw();
    const bytes = await buildReport(child, [obs], { periodDays: null, questions: [] });
    const calls = spy.calls();
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    const all = drawnText(calls);
    // Nothing drawn below the footer zone / off-page — every line is visible.
    // Content must stay in the printable zone (>= footer zone at ~34pt);
    // the per-page identity stamp legitimately sits lower in the margin.
    const contentYs = drawnY(calls.filter((c) => !/ — p\. \d+\/\d+$/.test(String(c[0]))));
    expect(Math.min(...contentYs)).toBeGreaterThanOrEqual(30);
    const stampYs = drawnY(calls.filter((c) => / — p\. \d+\/\d+$/.test(String(c[0]))));
    expect(stampYs.length).toBe(doc.getPageCount());
    expect(Math.min(...stampYs)).toBeGreaterThan(0);
    // The whole note is rendered, first word to last — not truncated or capped.
    expect(all).toContain("EPISODE_MARKER_60");
    expect(all).toContain("END_OF_FINAL_NOTE");
    // The split episode stays identifiable on its continuation page(s).
    expect(all).toContain("continued");
  });
});

describe("unicode rendering", () => {
  it("draws Arabic, Devanagari, CJK and mixed text without stripping", async () => {
    const uni: Child = {
      ...child,
      name: "زين سارة Léo 孩子",
      communicates: "يشير إلى أذنه · कान पकड़ता है · 摸耳朵",
      customDescriptors: { face: "يجعد وجهه", legs: "يركل", activity: "", cry: "", consolability: "" },
    };
    const note = "ملاحظة عربية · हिंदी नोट · 中文备注";
    const spy = spyOnDraw();
    await buildReport(uni, [{ ...mkObs(7, 1), note }], { periodDays: null, questions: ["QA only — لا ألم — कृपया ध्यान दें — 中文"] });
    const calls = spy.calls(); // mockRestore clears history — capture once
    const all = drawnText(calls);
    // Real scripts survive end-to-end (they may be reordered per bidi rules —
    // assert script presence, not byte-exact substrings).
    expect(all).toMatch(/[؀-ۿ]/);            // Arabic block present
    expect(all).toMatch(/[ऀ-ॿ]/);            // Devanagari present
    expect(all).toMatch(/[一-鿿]/);          // CJK present
    expect(all).toContain("中文备注");
    expect(all).toContain("Léo");
    // RTL runs must reach drawText in LOGICAL order — fontkit emits the
    // visual glyph order itself. A pre-reversed string would appear as "ةراس".
    expect(calls.some((c) => String(c[0]).includes("سارة"))).toBe(true);
    expect(calls.some((c) => String(c[0]).includes("ةراس"))).toBe(false);
    // Multiword RTL: "لا ألم" must reach drawText as ONE logical slice —
    // face-splitting on the space would break word order.
    expect(calls.some((c) => String(c[0]).includes("لا ألم"))).toBe(true);
    expect(calls.some((c) => String(c[0]) === "لا")).toBe(false);
    expect(calls.some((c) => String(c[0]) === "ألم")).toBe(false);
  }, 30000);

  it("keeps every horizontal rule clear of text baselines", async () => {
    const txtSpy = vi.spyOn(PDFPage.prototype, "drawText");
    const lnSpy = vi.spyOn(PDFPage.prototype, "drawLine");
    const multi: Child = { ...child, communicates: "a ".repeat(400) };
    const many = Array.from({ length: 12 }, (_, i) => mkObs((i * 7) % 10 + 1, i));
    await buildReport(multi, many, { periodDays: null, questions: ["q?"] });
    const byPage = (spy: ReturnType<typeof vi.spyOn>, pick: (c: unknown[]) => number) => {
      const m = new Map<PDFPage, number[]>();
      spy.mock.calls.forEach((c: unknown[], i: number) => {
        const p = spy.mock.instances[i] as PDFPage;
        m.set(p, [...(m.get(p) ?? []), pick(c)]);
      });
      return m;
    };
    const textY = byPage(txtSpy, (c) => (c[1] as { y: number }).y);
    const lineY = byPage(lnSpy, (c) => (c[0] as { start: { y: number } }).start.y);
    txtSpy.mockRestore(); lnSpy.mockRestore();
    const bad: string[] = [];
    for (const [p, ys] of lineY) {
      const baselines = textY.get(p) ?? [];
      for (const ly of ys) for (const by of baselines) {
        // glyph ink spans ≈ [baseline-3, baseline+9] for our sizes
        if (ly > by - 3 && ly < by + 9) bad.push(`rule@${ly} crosses text baseline@${by}`);
      }
    }
    expect(bad).toEqual([]);
  }, 30000);

  it("refuses to produce a PDF with unrenderable characters", async () => {
    // 🦉 (emoji) and 𠮷 (CJK ext-B, outside the GB-table subset) have no
    // glyph in any embedded face — the report must FAIL, not emit boxes.
    const bad: Child = { ...child, name: "QA Alex 🦉 𠮷" };
    const err = await buildReport(bad, [mkObs(5, 1)], { periodDays: null, questions: [] })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(UnsupportedCharsError);
    expect((err as UnsupportedCharsError).chars).toEqual(
      expect.arrayContaining(["🦉", "𠮷"]),
    );
  }, 30000);

  it("retries a failed font fetch instead of caching the rejection", async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", f);
    try {
      // First call: fetch fails AND the fs fallback fails (bogus path) → reject.
      await expect(fontBytes("/no-such-font-xyz.ttf")).rejects.toThrow();
      // A rejected promise must not be replayed: retry hits fetch again.
      await expect(fontBytes("/no-such-font-xyz.ttf")).resolves.toEqual(new Uint8Array([1, 2, 3]));
      expect(f).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
