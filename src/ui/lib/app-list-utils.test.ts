import { describe, expect, it } from 'vitest';
import type { AppEntry } from '../types';
import { clampIndex, filterApps, sortApps } from './app-list-utils';

const apps: AppEntry[] = [
  { id: 'a', name: 'Safari', displayName: 'Safari', path: '/a', iconDataUrl: '' },
  { id: 'b', name: 'Notes', displayName: '备忘录', path: '/b', iconDataUrl: '' },
  { id: 'c', name: 'Calculator', displayName: '计算器', path: '/c', iconDataUrl: '' },
];

describe('app list utils', () => {
  it('filters case-insensitively and supports exclusion', () => {
    expect(filterApps(apps, 'SAF').map((a) => a.id)).toEqual(['a']);
    expect(filterApps(apps, '', ['Safari']).map((a) => a.id)).toEqual(['b', 'c']);
    expect(filterApps(apps, 'zzz')).toEqual([]);
  });

  it('matches localized display names', () => {
    expect(filterApps(apps, '备忘').map((a) => a.id)).toEqual(['b']);
    expect(filterApps(apps, '', ['备忘录']).map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('sorts by name, favorites, and recency', () => {
    expect(sortApps(apps, 'name').map((a) => a.id)).toEqual(['b', 'c', 'a']);
    expect(sortApps(apps, 'favorites', ['b']).map((a) => a.id)).toEqual(['b', 'c', 'a']);
    expect(sortApps(apps, 'recent', [], { a: 200, b: 100 }).map((a) => a.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('wraps selection indexes', () => {
    expect(clampIndex(3, 3)).toBe(0);
    expect(clampIndex(-1, 3)).toBe(2);
    expect(clampIndex(0, 0)).toBe(-1);
  });
});
