import { isValidHexColor } from "./color";

export const MASTER_SCREENSAVER = "/screensaver/master-screensaver.png";
export const normalizeScreensaverColor = (hex: string) => isValidHexColor(hex) ? hex.trim().toUpperCase() : "#5E6AD2";

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (low: number, high: number, value: number) => {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};
const linear = Float64Array.from({ length: 256 }, (_, i) => {
  const value = i / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});
const encoded = Uint8ClampedArray.from({ length: 65536 }, (_, i) => {
  const value = i / 65535;
  return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
});

// Oklab transforms: Björn Ottosson's public-domain reference, https://bottosson.github.io/posts/oklab/
const toLab = (r: number, g: number, b: number, result: Float64Array) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  result[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  result[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  result[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
};
const toLinear = (L: number, a: number, b: number, result: Float64Array) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  result[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  result[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  result[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
};
const inGamut = (rgb: Float64Array) => rgb[0] >= 0 && rgb[0] <= 1 && rgb[1] >= 0 && rgb[1] <= 1 && rgb[2] >= 0 && rgb[2] <= 1;

export type PreparedArtwork = { pixels: Uint8ClampedArray; channels: Float32Array; hue: number };

/** Source analysis is shared by every color. Warm/near-neutral pixels need no hand-drawn mask. */
export const prepareArtwork = (pixels: Uint8ClampedArray): PreparedArtwork => {
  if (pixels.length % 4 !== 0) throw new Error("Artwork must contain RGBA pixels.");
  const channels = new Float32Array(pixels.length);
  const lab = new Float64Array(3);
  let sumA = 0; let sumB = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    toLab(linear[pixels[i]], linear[pixels[i + 1]], linear[pixels[i + 2]], lab);
    const chroma = Math.hypot(lab[1], lab[2]);
    const cool = smooth(0, 0.12, (pixels[i + 2] - pixels[i]) / 255);
    const neutral = smooth(0.012, 0.065, chroma);
    const highlight = smooth(0.72, 0.98, lab[0]) * (1 - smooth(0.035, 0.09, chroma));
    const weight = pixels[i + 3] === 0 ? 0 : cool * neutral * (1 - highlight);
    channels[i] = lab[0]; channels[i + 1] = lab[1]; channels[i + 2] = lab[2]; channels[i + 3] = weight;
    sumA += lab[1] * weight; sumB += lab[2] * weight;
  }
  return { pixels, channels, hue: Math.atan2(sumB, sumA) };
};

/** Change the cool palette while keeping per-pixel lightness/chroma variation and warm highlights. */
export const recolorArtwork = (art: PreparedArtwork, hex: string): Uint8ClampedArray => {
  const color = normalizeScreensaverColor(hex).slice(1);
  const target = new Float64Array(3);
  toLab(...[0, 2, 4].map(offset => linear[parseInt(color.slice(offset, offset + 2), 16)]) as [number, number, number], target);
  const targetChroma = Math.hypot(target[1], target[2]);
  const angle = targetChroma < 0.006 ? 0 : Math.atan2(target[2], target[1]) - art.hue;
  const cosine = Math.cos(angle); const sine = Math.sin(angle);
  const scale = 0.12 + Math.min(0.15, targetChroma) / 0.16;
  const lift = (target[0] - 0.64) * 0.18;
  const result = art.pixels.slice();
  const rgb = new Float64Array(3);
  for (let i = 0; i < result.length; i += 4) {
    const weight = art.channels[i + 3];
    if (weight < 0.001) continue;
    const sourceL = art.channels[i];
    const L = clamp(sourceL + lift * 4 * sourceL * (1 - sourceL));
    const a = (art.channels[i + 1] * cosine - art.channels[i + 2] * sine) * scale;
    const b = (art.channels[i + 1] * sine + art.channels[i + 2] * cosine) * scale;
    toLinear(L, a, b, rgb);
    if (!inGamut(rgb)) {
      // Preserve hue/lightness instead of clipping saturated colors into flat RGB patches.
      let low = 0; let high = 1;
      for (let step = 0; step < 5; step++) {
        const mid = (low + high) / 2;
        toLinear(L, a * mid, b * mid, rgb);
        if (inGamut(rgb)) low = mid; else high = mid;
      }
      toLinear(L, a * low, b * low, rgb);
    }
    for (let channel = 0; channel < 3; channel++) {
      const blended = linear[art.pixels[i + channel]] * (1 - weight) + rgb[channel] * weight;
      result[i + channel] = encoded[Math.round(clamp(blended) * 65535)];
    }
  }
  return result;
};
