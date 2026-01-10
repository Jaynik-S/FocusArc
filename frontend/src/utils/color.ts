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

export const getContrastColor = (value: string, fallback = "#111827") => {
  const rgb = parseHex(value);
  if (!rgb) {
    return fallback;
  }
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
};

export const getMutedTextColor = (value: string) => {
  const contrast = getContrastColor(value);
  return contrast === "#ffffff"
    ? "rgba(255, 255, 255, 0.78)"
    : "rgba(17, 24, 39, 0.72)";
};
