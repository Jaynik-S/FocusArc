import type { ScreensaverWallpaperDefinition } from "./screensaverWallpapers";
import { normalizeScreensaverColor } from "./screensaverRecolor";

export type EnvironmentId = ScreensaverWallpaperDefinition["id"];
export const ARTWORK = { width: 1672, height: 941 };
export const coverTransform = (width: number, height: number) => {
  const scale = Math.max(width / ARTWORK.width, height / ARTWORK.height);
  return { scale, x: (width - ARTWORK.width * scale) / 2, y: (height - ARTWORK.height * scale) / 2 };
};
const random = (seed: number) => () => {
  seed = Math.imul(1664525, seed) + 1013904223;
  return (seed >>> 0) / 4294967296;
};
const hash = (seed: number) => random(Math.imul(seed + 1, 2654435761))();
const wrap = (value: number, size: number) => ((value % size) + size) % size;

export type Particle = {
  kind: "dust" | "firefly" | "pollen" | "petal" | "mote" | "snow";
  x: number; y: number; size: number; speed: number; drift: number; phase: number; frequency: number; depth: number;
};
type Point = readonly [number, number];
type Light = readonly [number, number, number];
export type EnvironmentScene = { id: EnvironmentId; particles: Particle[]; stars: readonly Point[]; lights: readonly Light[]; reflections: readonly Point[] };

const profiles = {
  space: { seed: 11, groups: [["dust", 32]], stars: [[.14,.023],[.35,.15],[.72,.095],[.42,.30],[.82,.40],[.89,.84],[.30,.80]], lights: [], reflections: [] },
  forest: { seed: 29, groups: [["firefly", 26],["pollen",14]], stars: [[.63,.15],[.71,.04]], lights: [[.353,.595,35],[.187,.41,12],[.867,.626,12]], reflections: [[.58,.77],[.72,.86],[.89,.80]] },
  "sky-garden": { seed: 47, groups: [["petal",12],["mote",18]], stars: [], lights: [], reflections: [[.77,.23],[.68,.14]] },
  winter: { seed: 71, groups: [["snow",80]], stars: [[.70,.30],[.19,.14]], lights: [[.91,.62,40]], reflections: [[.30,.73],[.45,.84],[.58,.78],[.20,.90],[.51,.69]] },
  village: { seed: 97, groups: [["firefly",18],["mote",12]], stars: [], lights: [[.221,.40,27],[.124,.36,19],[.862,.18,20],[.75,.32,18],[.64,.49,13],[.88,.49,16]], reflections: [[.57,.75],[.68,.84],[.84,.91],[.77,.70],[.92,.82]] },
} as const;

export const createEnvironmentScene = (id: EnvironmentId): EnvironmentScene => {
  const profile = profiles[id]; const next = random(profile.seed); const particles: Particle[] = [];
  for (const [kind, count] of profile.groups) for (let i = 0; i < count; i++) {
    const depth = next();
    particles.push({ kind, depth, x: next() * ARTWORK.width, y: next() * ARTWORK.height,
      size: kind === "petal" ? 3 + depth * 5 : kind === "snow" ? .45 + depth * depth * 3 : .5 + depth * 1.6,
      speed: kind === "snow" ? 8 + depth * 35 : kind === "petal" ? 13 + depth * 13 : 1 + depth * 5,
      drift: kind === "snow" ? 2 + next() * 5 : kind === "petal" ? 7 + next() * 10 : next() * 3 - 1.5,
      phase: next() * Math.PI * 2, frequency: .13 + next() * .28 });
  }
  return { id, particles, stars: profile.stars, lights: profile.lights, reflections: profile.reflections };
};

export const particlePosition = (particle: Particle, time: number) => {
  const p = particle;
  if (p.kind === "firefly") return { x: p.x + Math.sin(time * p.frequency + p.phase) * 22 + Math.sin(time * .73 + p.phase) * 4,
    y: p.y * .73 + 170 + Math.cos(time * p.frequency * .81 + p.phase) * 17 };
  const falling = p.kind === "snow" || p.kind === "petal";
  return { x: wrap(p.x + time * p.drift + Math.sin(time * p.frequency + p.phase) * (falling ? 15 : 9) + 30, ARTWORK.width + 60) - 30,
    y: wrap(p.y + time * p.speed * (falling ? 1 : -1) + 35, ARTWORK.height + 70) - 35 };
};

export const environmentPalette = (hex: string, bright: boolean) => {
  const normalized = normalizeScreensaverColor(hex).slice(1);
  const rgb = [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16));
  const mix = (toward: number[], weight: number, shade = 1) => `rgb(${rgb.map((value, i) => Math.round((value * (1 - weight) + toward[i] * weight) * shade)).join(",")})`;
  return { accent: bright ? mix([35,52,65], .5) : mix([255,245,216], .65),
    petal: mix([255,219,213], .7, bright ? .75 : 1), cream: "rgb(255,245,216)", warm: "rgb(255,211,139)" };
};
export type EnvironmentPalette = ReturnType<typeof environmentPalette>;

/** Irregular 13–25 second intervals; a new path for each short-lived event. */
export const meteorAt = (time: number) => {
  const slot = Math.floor(time / 19); const start = slot * 19 + 5 + hash(slot + 13) * 6;
  const progress = (time - start) / (1.1 + hash(slot + 31) * .5);
  return progress >= 0 && progress <= 1 ? { progress, x: .18 + hash(slot + 71) * .52, y: .035 + hash(slot + 91) * .16 } : null;
};
