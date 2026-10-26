import { isValidHexColor } from "./color";

// Authored palettes retain the warm highlights and texture that extreme filters lose.
// Add another text-free wallpaper here to extend the available color range.
export const SCREENSAVER_WALLPAPERS = [
  { name: "blue", src: "/screensaver/space-blue.png", hue: 205 },
  { name: "orange", src: "/screensaver/space-orange.png", hue: 18 },
  { name: "purple", src: "/screensaver/space-purple.png", hue: 270 },
] as const;

const hueDifference = (target: number, source: number) => ((target - source + 540) % 360) - 180;

export const getScreensaverTheme = (hex: string) => {
  const color = (isValidHexColor(hex) ? hex : "#5e6ad2").trim().slice(1);
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  if (saturation < 0.12) return { ...SCREENSAVER_WALLPAPERS[0], filter: "saturate(0.45)" };
  const sector = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const hue = (sector * 60 + 360) % 360;
  const palette = SCREENSAVER_WALLPAPERS.reduce((closest, candidate) =>
    Math.abs(hueDifference(hue, candidate.hue)) < Math.abs(hueDifference(hue, closest.hue)) ? candidate : closest);
  const difference = hueDifference(hue, palette.hue);
  // Use the closest original palette when its hue is too far away for a tasteful recolor.
  const filter = Math.abs(difference) > 40 ? "none" : `hue-rotate(${Math.round(Math.max(-24, Math.min(24, difference)))}deg)`;
  return { ...palette, filter };
};
