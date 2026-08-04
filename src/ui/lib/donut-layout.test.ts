import { describe, expect, it } from 'vitest';
import type { AppEntry } from '../types';
import {
  calculatePageCount,
  calculateRingCount,
  calculateViewSize,
  layoutApps,
  paginateApps,
} from './donut-layout';

function fakeApps(count: number): AppEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `app-${i}`,
    name: `App ${i}`,
    displayName: `App ${i}`,
    path: `/Applications/App ${i}.app`,
    iconDataUrl: '',
  }));
}

describe('donut layout', () => {
  it('keeps every icon inside the dynamic viewBox', () => {
    for (const count of [1, 6, 24, 54]) {
      const viewSize = calculateViewSize(count);
      const layout = layoutApps(fakeApps(count), ['#fff'], 0, viewSize);
      expect(layout.icons.length).toBe(count);
      for (const icon of layout.icons) {
        const edge = layout.iconSize / 2;
        expect(icon.x - edge).toBeGreaterThanOrEqual(0);
        expect(icon.x + edge).toBeLessThanOrEqual(viewSize);
        expect(icon.y - edge).toBeGreaterThanOrEqual(0);
        expect(icon.y + edge).toBeLessThanOrEqual(viewSize);
      }
    }
  });

  it('caps the view size at the 3-ring size', () => {
    expect(calculateViewSize(0)).toBe(720);
    expect(calculateViewSize(100)).toBe(calculateViewSize(54));
    expect(calculateViewSize(54)).toBe(720);
    expect(calculateViewSize(1)).toBe(720);
  });

  it('grows ring count with app count', () => {
    expect(calculateRingCount(50)).toBeGreaterThan(calculateRingCount(24));
    expect(calculateRingCount(0)).toBe(0);
  });

  it('caps ring count at 3 even with many apps', () => {
    expect(calculateRingCount(100)).toBe(3);
    expect(calculateRingCount(200)).toBe(3);
  });

  it('calculates page count from the 3-ring capacity', () => {
    const capacity = 10 + 18 + 26; // 54
    expect(calculatePageCount(0)).toBe(1);
    expect(calculatePageCount(capacity)).toBe(1);
    expect(calculatePageCount(capacity + 1)).toBe(2);
    expect(calculatePageCount(200)).toBe(4);
  });

  it('paginates apps into pages of at most 54', () => {
    const apps = fakeApps(60);
    const page0 = paginateApps(apps, 0);
    expect(page0.pageCount).toBe(2);
    expect(page0.pageApps.length).toBe(54);
    const page1 = paginateApps(apps, 1);
    expect(page1.pageApps.length).toBe(6);
    expect(page1.pageApps[0].id).toBe('app-54');

    const clamped = paginateApps(apps, 5);
    expect(clamped.pageApps[0].id).toBe('app-54');
  });

  it('keeps every icon inside the viewBox for a full page', () => {
    const apps = fakeApps(54);
    const viewSize = calculateViewSize(apps.length);
    const layout = layoutApps(apps, ['#fff'], 0, viewSize);
    expect(layout.rings.length).toBe(3);
    expect(layout.icons.length).toBe(54);
    for (const icon of layout.icons) {
      const edge = layout.iconSize / 2;
      expect(icon.x - edge).toBeGreaterThanOrEqual(0);
      expect(icon.x + edge).toBeLessThanOrEqual(viewSize);
      expect(icon.y - edge).toBeGreaterThanOrEqual(0);
      expect(icon.y + edge).toBeLessThanOrEqual(viewSize);
    }
  });
});
