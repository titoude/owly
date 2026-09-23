import { describe, expect, it } from "vitest";
import { FLACC, totalFlacc } from "../flacc";
import { bandFor, FLACC_CATEGORIES } from "../types";

describe("FLACC scale", () => {
  it("has 5 categories with 3 descriptors each", () => {
    expect(FLACC_CATEGORIES).toEqual(["face", "legs", "activity", "cry", "consolability"]);
    for (const c of FLACC_CATEGORIES) {
      expect(FLACC[c].descriptors).toHaveLength(3);
    }
  });

  it("sums scores 0-10", () => {
    expect(totalFlacc({ face: 2, legs: 2, activity: 2, cry: 2, consolability: 2 })).toBe(10);
    expect(totalFlacc({ face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 })).toBe(0);
    expect(totalFlacc({ face: 1, legs: 0, activity: 2, cry: 0, consolability: 1 })).toBe(4);
  });
});

describe("bandFor", () => {
  it("maps totals to bands", () => {
    expect(bandFor(0)).toBe("none");
    expect(bandFor(1)).toBe("mild");
    expect(bandFor(3)).toBe("mild");
    expect(bandFor(4)).toBe("moderate");
    expect(bandFor(6)).toBe("moderate");
    expect(bandFor(7)).toBe("severe");
    expect(bandFor(10)).toBe("severe");
  });
});
