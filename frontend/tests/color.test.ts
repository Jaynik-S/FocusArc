import { describe, expect, it } from "vitest";

import { getContrastColor } from "../src/utils/color";

describe("getContrastColor", () => {
  it.each([
    ["#111827", "#ffffff"],
    ["#8f9250", "#111827"],
    ["#f5c451", "#111827"],
    ["#ff0000", "#000000"],
    ["#777777", "#000000"],
  ])("selects readable action text for %s", (background, expected) => {
    expect(getContrastColor(background)).toBe(expected);
  });
});
