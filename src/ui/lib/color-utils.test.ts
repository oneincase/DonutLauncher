import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex, normalizeHex } from './color-utils';

describe('color utils', () => {
  it('round-trips hex through HSL', () => {
    const hex = '#FF6B9D';
    const { h, s, l } = hexToHsl(hex);
    expect(hexToHsl(hslToHex(h, s, l))).toEqual({ h, s, l });
  });

  it('normalizes hex input', () => {
    expect(normalizeHex('ff6b9d')).toBe('#FF6B9D');
    expect(normalizeHex('#abc123')).toBe('#ABC123');
    expect(normalizeHex('nope')).toBeNull();
  });
});
