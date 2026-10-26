import { expect, it } from "vitest";
import { landscapeDisplacement, landscapeRegions } from "../src/utils/screensaverLandscape";

it("authors movement in water and aurora while keeping displacement bounded and feathered at its edges", () => {
  for (const id of ["forest", "sky-garden", "winter", "village"] as const) {
    expect(landscapeRegions[id].length).toBeGreaterThan(0);
    for (const region of landscapeRegions[id]) {
      expect(region.polygon.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
      expect(landscapeDisplacement(region.kind, 0, 3)).toEqual({ x: 0, y: 0, opacity: 0 });
      expect(landscapeDisplacement(region.kind, 1, 3).opacity).toBeCloseTo(0);
      expect(landscapeDisplacement(region.kind, .4, 1)).not.toEqual(landscapeDisplacement(region.kind, .4, 3));
      for (let time = 0; time < 30; time += .7) {
        const shift = landscapeDisplacement(region.kind, .4, time);
        expect(Math.abs(shift.x)).toBeLessThanOrEqual(22);
        expect(Math.abs(shift.y)).toBeLessThanOrEqual(10);
        expect(shift.opacity).toBeGreaterThanOrEqual(0);
        expect(shift.opacity).toBeLessThanOrEqual(1);
      }
    }
  }
});

it("keeps character landmarks and the center of the timer outside texture distortion", () => {
  const protectedPoints = {
    forest: [[.26,.55],[.353,.595],[.5,.49]],
    "sky-garden": [[.26,.65],[.5,.49]],
    winter: [[.78,.66],[.91,.62],[.5,.49]],
    village: [[.31,.61],[.22,.45],[.5,.49]],
  } as const;
  for (const id of ["forest", "sky-garden", "winter", "village"] as const) {
    for (const area of landscapeRegions[id]) for (const [px, py] of protectedPoints[id]) {
      let inside = false;
      for (let i = 0, j = area.polygon.length - 1; i < area.polygon.length; j = i++) {
        const [xi, yi] = area.polygon[i]; const [xj, yj] = area.polygon[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      expect(inside).toBe(false);
    }
  }
});
