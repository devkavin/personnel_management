import { describe, expect, it } from "vitest";
import { expandTemplateEntries, generateScheduleDates, wouldCreateTaxonomyCycle } from "../src/modules/scheduling/domain.js";

describe("scheduling domain", () => {
  it("supports bounded arbitrary date ranges", () => {
    const dates = generateScheduleDates("2026-06-19", "2026-06-22", "range");
    expect(dates).toEqual([
      { date: "2026-06-19", weekday: 5 },
      { date: "2026-06-20", weekday: 6 },
      { date: "2026-06-21", weekday: 7 },
      { date: "2026-06-22", weekday: 1 }
    ]);
    expect(() => generateScheduleDates("2026-01-01", "2027-01-02", "range")).toThrow(/366 days/);
  });

  it("repeats week-template cells across a range", () => {
    const dates = generateScheduleDates("2026-06-15", "2026-06-29", "range");
    const occurrences = expandTemplateEntries(dates, [{ weekday: 1, slotId: 4, sessionTemplateId: 9 }]);
    expect(occurrences.map((item) => item.date)).toEqual(["2026-06-15", "2026-06-22", "2026-06-29"]);
  });

  it("prevents moving a taxonomy node into any descendant", () => {
    const parents = new Map<number, number | null>([[1, null], [2, 1], [3, 2], [4, null]]);
    expect(wouldCreateTaxonomyCycle(1, 3, parents)).toBe(true);
    expect(wouldCreateTaxonomyCycle(2, 4, parents)).toBe(false);
    expect(wouldCreateTaxonomyCycle(3, null, parents)).toBe(false);
  });
});
