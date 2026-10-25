import { describe, expect, it } from "vitest";
import { dayBounds } from "../src/utils/timeline";

describe("schedule day boundaries", () => {
  it.each([
    ["2026-03-08", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z"],
    ["2026-11-01", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"],
  ])("uses real day length across DST on %s", (day, start, end) => {
    const bounds = dayBounds(day, "America/Toronto");
    expect(new Date(bounds.start).toISOString()).toBe(start);
    expect(new Date(bounds.end).toISOString()).toBe(end);
  });
});
