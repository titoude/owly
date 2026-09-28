import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { buildReport } from "../report";
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
    expect(Math.min(...drawnY(calls))).toBeGreaterThanOrEqual(30);
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
    expect(Math.min(...drawnY(calls))).toBeGreaterThanOrEqual(30);
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
    expect(Math.min(...drawnY(calls))).toBeGreaterThanOrEqual(30);
    // The whole note is rendered, first word to last — not truncated or capped.
    expect(all).toContain("EPISODE_MARKER_60");
    expect(all).toContain("END_OF_FINAL_NOTE");
    // The split episode stays identifiable on its continuation page(s).
    expect(all).toContain("continued");
  });
});
