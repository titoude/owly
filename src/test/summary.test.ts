import { describe, expect, it } from "vitest";
import { mostlyAtNight, summarize, timeBucket } from "../summary";
import type { Observation } from "../types";

const NOW = new Date(2026, 9, 20, 12, 0).getTime();
const at = (daysAgo: number, hour: number) => {
  const d = new Date(NOW - daysAgo * 864e5);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};
const mk = (o: Partial<Observation> & { startedAt: number }): Observation => ({
  childId: 1,
  recordedAt: o.startedAt,
  scores: { face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 },
  total: 0,
  durationMinutes: null,
  bodyZones: [],
  suspectedCause: "",
  interventions: [],
  note: "",
  baseline: false,
  ...o,
});

describe("summarize", () => {
  it("separates episodes from calm baselines and sorts oldest first", () => {
    const s = summarize([
      mk({ startedAt: at(1, 23), total: 6 }),
      mk({ startedAt: at(5, 10), baseline: true }),
      mk({ startedAt: at(3, 2), total: 8 }),
    ], null, NOW);
    expect(s.episodes.map((o) => o.total)).toEqual([8, 6]);
    expect(s.baselines).toHaveLength(1);
    expect(s.avg).toBe(7);
    expect(s.max).toBe(8);
  });

  it("applies the reporting period to episodes and baselines alike", () => {
    const s = summarize([
      mk({ startedAt: at(2, 23), total: 5 }),
      mk({ startedAt: at(40, 23), total: 9 }),
      mk({ startedAt: at(45, 9), baseline: true }),
    ], 30, NOW);
    expect(s.episodes.map((o) => o.total)).toEqual([5]);
    expect(s.baselines).toHaveLength(0);
  });

  it("counts areas, medication labels and recorded outcomes", () => {
    const s = summarize([
      mk({ startedAt: at(1, 23), total: 6, bodyZones: ["ears", "head"], interventions: [
        { type: "medication", label: "ibuprofen", helped: "yes" },
        { type: "comfort", label: "", helped: "no" },
      ] }),
      mk({ startedAt: at(2, 1), total: 7, bodyZones: ["ears"], interventions: [
        { type: "medication", label: "ibuprofen", helped: "yes" },
        { type: "comfort", label: "", helped: null },
      ] }),
    ], null, NOW);
    expect(s.zones).toEqual([["ears", 2], ["head", 1]]);
    expect(s.meds).toEqual(["ibuprofen"]);
    // An intervention without a recorded outcome is not counted as a use.
    expect(s.helped).toEqual([["medication", { yes: 2, n: 2 }], ["comfort", { yes: 0, n: 1 }]]);
  });

  it("returns neutral numbers for an empty journal", () => {
    const s = summarize([], 7, NOW);
    expect(s.avg).toBe(0);
    expect(s.max).toBe(0);
    expect(mostlyAtNight(s)).toBe(false);
  });
});

describe("time of day", () => {
  it("buckets hours at the documented boundaries", () => {
    expect([21, 22, 5, 6, 11, 12, 17, 18].map(timeBucket)).toEqual([
      "evening", "night", "night", "morning", "morning", "afternoon", "afternoon", "evening",
    ]);
  });

  it("reports night only when it is the clear majority", () => {
    const night = (n: number) => Array.from({ length: n }, (_, i) => mk({ startedAt: at(i + 1, 23), total: 5 }));
    const day = (n: number) => Array.from({ length: n }, (_, i) => mk({ startedAt: at(i + 1, 14), total: 5 }));
    expect(mostlyAtNight(summarize([...night(3), ...day(1)], null, NOW))).toBe(true);
    expect(mostlyAtNight(summarize([...night(2), ...day(2)], null, NOW))).toBe(false);
    expect(mostlyAtNight(summarize(night(1), null, NOW))).toBe(false);
  });
});
