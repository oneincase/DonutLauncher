export const DEFAULT_COLORS = ['#FF6B9D', '#4ECDC4', '#FFE66D'];

export const COLOR_PRESETS = [
  '#FF6B9D',
  '#4ECDC4',
  '#FFE66D',
  '#4C9AFF',
  '#51CF66',
  '#FF922B',
  '#AE7FF0',
  '#FFFFFF',
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = clamp(s / 100, 0, 1);
  const light = clamp(l / 100, 0, 1);
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = light - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 1 / 6) {
    r = chroma;
    g = x;
  } else if (hue < 2 / 6) {
    r = x;
    g = chroma;
  } else if (hue < 3 / 6) {
    g = chroma;
    b = x;
  } else if (hue < 4 / 6) {
    g = x;
    b = chroma;
  } else if (hue < 5 / 6) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }
  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = (hex || '').replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function normalizeHex(value: string): string | null {
  const match = String(value || '')
    .trim()
    .match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : null;
}
