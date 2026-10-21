import { describe, expect, it } from "vitest";
import { civilDayCount, formatCivilDate, isCivilDate, shiftCivilDate, validateAnalyticsRange } from "../src/utils/date";

describe("analytics civil dates", () => {
  it("counts and shifts calendar dates across leap days and DST without host-zone drift", () => {
    expect(shiftCivilDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftCivilDate("2026-03-09", -1)).toBe("2026-03-08");
    expect(shiftCivilDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(civilDayCount("2025-10-17", "2026-10-16")).toBe(365);
    expect(formatCivilDate("2026-03-08")).toBe("Mar 8");
  });

  it("rejects impossible dates, future dates and oversized ranges", () => {
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("2024-02-29")).toBe(true);
    expect(validateAnalyticsRange("2026-01-01", "2026-01-01", "2026-10-16")).toBeNull();
    expect(validateAnalyticsRange("2025-10-16", "2026-10-16", "2026-10-16")).toMatch(/365/);
    expect(validateAnalyticsRange("2026-10-17", "2026-10-17", "2026-10-16")).toMatch(/today/);
  });
});
