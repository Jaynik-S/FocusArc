import { expect, it } from "vitest";
import { coverTransform, createEnvironmentScene, environmentPalette, meteorAt, particlePosition } from "../src/utils/screensaverAnimation";
import { SCREENSAVER_WALLPAPERS } from "../src/utils/screensaverWallpapers";

it("aligns source landmarks with centered cover at desktop and narrow sizes", () => {
  const desktop = coverTransform(900, 700);
  expect(desktop.scale).toBeCloseTo(700 / 941);
  expect(desktop.x + 836 * desktop.scale).toBeCloseTo(450);
  expect(desktop.y).toBeCloseTo(0);
  const narrow = coverTransform(320, 568);
  expect(narrow.x + 836 * narrow.scale).toBeCloseTo(160);
  expect(narrow.y + 470.5 * narrow.scale).toBeCloseTo(284);
});

it("creates distinct stable bounded particle fields without consuming global randomness", () => {
  const original = Math.random;
  Math.random = () => { throw new Error("Animation must not consume wallpaper-selection randomness"); };
  try {
    const scenes = SCREENSAVER_WALLPAPERS.map(item => createEnvironmentScene(item.id));
    for (const scene of scenes) {
      expect(scene).toEqual(createEnvironmentScene(scene.id));
      expect(scene.particles.length).toBeGreaterThan(10);
      expect(scene.particles.length).toBeLessThanOrEqual(90);
      for (const particle of scene.particles) {
        const point = particlePosition(particle, 123.4);
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(-50);
        expect(point.x).toBeLessThanOrEqual(1722);
      }
    }
    expect(new Set(scenes.map(scene => scene.particles[0].kind)).size).toBeGreaterThan(2);
  } finally { Math.random = original; }
});

it("derives usable scene accents from arbitrary HEX while keeping warm and cream highlights natural", () => {
  for (const color of ["#A8D5BA", "#42216F", "#FFFFFF", "#000000", "#FF0000", "bad"]) {
    const palette = environmentPalette(color, false);
    expect(palette.cream).toBe("rgb(255,245,216)");
    expect(palette.warm).toBe("rgb(255,211,139)");
    expect(palette.accent).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  }
  expect(environmentPalette("#A8D5BA", false).accent).not.toBe(environmentPalette("#42216F", false).accent);
  expect(environmentPalette("#FFFFFF", true).accent).not.toBe(environmentPalette("#FFFFFF", false).accent);
});

it("schedules occasional varied meteors rather than a constant repeating streak", () => {
  let visible = 0; const starts = new Set<number>();
  for (let time = 0; time < 120; time += 0.1) {
    const meteor = meteorAt(time);
    if (meteor) { visible++; starts.add(meteor.x); expect(meteor.progress).toBeGreaterThanOrEqual(0); expect(meteor.progress).toBeLessThanOrEqual(1); }
  }
  expect(visible).toBeGreaterThan(10);
  expect(visible).toBeLessThan(160);
  expect(starts.size).toBeGreaterThan(3);
});
