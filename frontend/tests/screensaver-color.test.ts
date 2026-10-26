import { expect, it } from "vitest";
import { normalizeScreensaverColor, prepareArtwork, recolorArtwork } from "../src/utils/screensaverRecolor";

const colors = ["#A8D5BA", "#42216F", "#F3A7BB", "#377DC2", "#E9B44C", "#343434", "#FFFFFF", "#FF0000"];
const source = new Uint8ClampedArray([
  10, 44, 70, 255, 30, 95, 140, 255, 92, 170, 202, 255,
  255, 245, 212, 255, 246, 247, 244, 255, 50, 90, 120, 0,
]);

it("normalizes exact HEX keys and safely defaults invalid input", () => {
  expect(normalizeScreensaverColor(" #a8d5ba ")).toBe("#A8D5BA");
  expect(normalizeScreensaverColor("bad")).toBe("#5E6AD2");
});

it("preserves warm cream, neutral highlights and alpha without mutating source data", () => {
  const before = source.slice();
  const prepared = prepareArtwork(source);
  for (const color of colors) {
    const result = recolorArtwork(prepared, color);
    expect(Array.from(result.slice(12))).toEqual(Array.from(source.slice(12)));
    expect(result).not.toBe(source);
  }
  expect(source).toEqual(before);
});

it("gives all validation colors distinct atmospheric results, including neutral brightness", () => {
  const prepared = prepareArtwork(source);
  const results = colors.map(color => Array.from(recolorArtwork(prepared, color).slice(0, 12)).join(","));
  expect(new Set(results).size).toBe(colors.length);
  expect(recolorArtwork(prepared, "#000000")[4]).toBeLessThan(recolorArtwork(prepared, "#FFFFFF")[4]);
});

it("responds to lightness and chroma differences within one color family and retains shading", () => {
  const prepared = prepareArtwork(source);
  const light = recolorArtwork(prepared, "#A8D5BA");
  const dark = recolorArtwork(prepared, "#28553A");
  expect(light.slice(0, 12)).not.toEqual(dark.slice(0, 12));
  for (const color of colors) {
    const pixels = recolorArtwork(prepared, color);
    const brightness = (offset: number) => pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
    expect(brightness(0)).toBeLessThan(brightness(4));
    expect(brightness(4)).toBeLessThan(brightness(8));
  }
});
