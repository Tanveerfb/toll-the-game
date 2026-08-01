import { describe, expect, it } from "vitest";
import { sortByDateDesc } from "@/lib/news/sortByDateDesc";

describe("sortByDateDesc", () => {
  it("sorts ISO date strings newest first", () => {
    const items = [{ date: "2026-07-29" }, { date: "2026-08-01" }, { date: "2026-07-31" }];
    expect(sortByDateDesc(items).map((i) => i.date)).toEqual([
      "2026-08-01",
      "2026-07-31",
      "2026-07-29",
    ]);
  });

  it("does not mutate the input array", () => {
    const items = [{ date: "2026-07-29" }, { date: "2026-08-01" }];
    const original = [...items];
    sortByDateDesc(items);
    expect(items).toEqual(original);
  });

  it("returns an empty array unchanged", () => {
    expect(sortByDateDesc([])).toEqual([]);
  });

  it("preserves extra fields on each item", () => {
    const items = [{ date: "2026-07-29", title: "A" }, { date: "2026-08-01", title: "B" }];
    expect(sortByDateDesc(items)[0]).toEqual({ date: "2026-08-01", title: "B" });
  });
});
