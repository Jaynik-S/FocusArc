const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const isValidHexColor = (value: string) => HEX_COLOR.test(value.trim());

const parseHex = (value: string) => {
  if (!isValidHexColor(value)) {
    return null;
  }
  const hex = value.trim().replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

const linearizeChannel = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
  0.2126 * linearizeChannel(r) +
  0.7152 * linearizeChannel(g) +
  0.0722 * linearizeChannel(b);

const contrastRatio = (first: number, second: number) =>
  (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

const DARK_TEXT = { r: 17, g: 24, b: 39 };

export const getContrastColor = (value: string, fallback = "#111827") => {
  const rgb = parseHex(value);
  if (!rgb) {
    return fallback;
  }
  const backgroundLuminance = relativeLuminance(rgb);
  const darkContrast = contrastRatio(backgroundLuminance, relativeLuminance(DARK_TEXT));
  const lightContrast = contrastRatio(backgroundLuminance, 1);
  return darkContrast >= lightContrast ? "#111827" : "#ffffff";
};

export const getMutedTextColor = (value: string) => {
  const contrast = getContrastColor(value);
  return contrast === "#ffffff"
    ? "rgba(255, 255, 255, 0.78)"
    : "rgba(17, 24, 39, 0.72)";
};
