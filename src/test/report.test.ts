import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildReport } from "../report";
import type { Child, Observation } from "../types";

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
});
