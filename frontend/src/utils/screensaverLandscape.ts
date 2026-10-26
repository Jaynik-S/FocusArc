import { ARTWORK, type EnvironmentId } from "./screensaverAnimation";

type Kind = "ripple" | "fall" | "aurora" | "ice";
type Point = readonly [number, number];
const region = (kind: Kind, polygon: readonly Point[]) => {
  const xs = polygon.map(([x]) => x * ARTWORK.width); const ys = polygon.map(([, y]) => y * ARTWORK.height);
  return { kind, polygon, x: Math.min(...xs), y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

// Source-image landmarks exclude characters, buildings and the timer's center.
export const landscapeRegions = {
  space: [],
  forest: [
    region("ripple", [[.59,.80],[.73,.78],[.84,.79],[.81,.86],[.98,.91],[1,.99],[.77,.99],[.73,.93],[.66,.88],[.55,.88],[.53,.85],[.68,.83]]),
    region("fall", [[.789,.464],[.818,.465],[.828,.54],[.795,.555],[.79,.51]]),
    region("fall", [[.796,.584],[.832,.575],[.819,.696],[.783,.751],[.772,.724]]),
    region("fall", [[.609,.639],[.678,.647],[.717,.703],[.732,.753],[.697,.779],[.665,.725],[.64,.684]]),
  ],
  "sky-garden": [
    region("fall", [[.194,.237],[.218,.237],[.211,.438],[.187,.458]]),
    region("fall", [[.780,.511],[.795,.511],[.788,.646],[.773,.653]]),
    region("fall", [[.780,.721],[.861,.722],[.852,.88],[.818,.971],[.786,.888]]),
  ],
  winter: [
    region("aurora", [[.22,0],[.44,0],[.392,.122],[.333,.245],[.28,.29],[.25,.205]]),
    region("aurora", [[.64,0],[.92,0],[.82,.10],[.746,.17],[.695,.267],[.624,.296],[.663,.16]]),
    region("ice", [[.13,.675],[.36,.641],[.59,.674],[.68,.72],[.635,.775],[.565,.805],[.544,.866],[.35,.841],[.23,.82],[.13,.752]]),
  ],
  village: [
    region("ripple", [[.51,.742],[.60,.738],[.67,.77],[.706,.82],[.78,.843],[.80,.90],[.89,.938],[.94,1],[.78,1],[.663,.934],[.64,.853],[.57,.82],[.51,.78]]),
    region("fall", [[.459,.512],[.508,.514],[.518,.597],[.474,.605]]),
    region("fall", [[.807,.487],[.839,.482],[.833,.648],[.800,.662]]),
    region("fall", [[.826,.817],[.875,.807],[.862,.922],[.813,.931]]),
  ],
} satisfies Record<EnvironmentId, ReturnType<typeof region>[]>;

/** Bounded waves fade into the untouched artwork instead of sliding whole patches. */
export const landscapeDisplacement = (kind: Kind, v: number, time: number) => {
  const envelope = Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, v))));
  if (v <= 0 || v >= 1) return { x: 0, y: 0, opacity: 0 };
  const x = kind === "aurora" ? Math.sin(time * .36 + v * 4) * 14 + Math.sin(time * .21 - v * 7) * 6
    : kind === "fall" ? Math.sin(v * 12 - time * 2.1) * 2
    : (Math.sin(v * 27 + time * 1.3) * 6 + Math.sin(v * 43 - time * .8) * 2) * (kind === "ice" ? .25 : 1);
  const y = kind === "fall" ? Math.sin(v * 12 - time * 2.5) * 8
    : kind === "aurora" ? Math.sin(time * .29 + v * 7) * 3
    : Math.sin(v * 25 - time * 1.4) * (kind === "ice" ? .4 : 1.5);
  return { x: x * envelope, y: y * envelope, opacity: Math.pow(envelope, .6) * .88 };
};

/** Reuse the committed recolored pixels; no decoding, pixel reads or worker jobs per frame. */
export const drawScreensaverLandscape = (ctx: CanvasRenderingContext2D, id: EnvironmentId, time: number, artwork: HTMLCanvasElement | null) => {
  if (!artwork || artwork.width !== ARTWORK.width || artwork.height !== ARTWORK.height) return;
  for (const area of landscapeRegions[id]) {
    ctx.save(); ctx.beginPath();
    area.polygon.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x * ARTWORK.width, y * ARTWORK.height);
      else ctx.lineTo(x * ARTWORK.width, y * ARTWORK.height);
    });
    ctx.closePath(); ctx.clip();
    for (let row = 0; row < area.height; row += 8) {
      const height = Math.min(8, area.height - row); const shift = landscapeDisplacement(area.kind, (row + height / 2) / area.height, time);
      ctx.globalAlpha = shift.opacity;
      ctx.drawImage(artwork, area.x + shift.x, area.y + row + shift.y, area.width, height + .5,
        area.x, area.y + row, area.width, height + .5);
    }
    ctx.restore();
  }
};
