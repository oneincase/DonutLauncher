import type { AppEntry } from '../types';

export function filterApps(
  apps: AppEntry[],
  query = '',
  excluded: string[] = [],
): AppEntry[] {
  const q = query.trim().toLowerCase();
  const excludedSet = new Set(excluded);
  return apps.filter((app) => {
    const name = app.name || '';
    const displayName = app.displayName || name;
    if (excludedSet.has(name) || excludedSet.has(displayName)) return false;
    if (!q) return true;
    return name.toLowerCase().includes(q) || displayName.toLowerCase().includes(q);
  });
}

export function sortApps(
  apps: AppEntry[],
  mode: 'name' | 'recent' | 'favorites' = 'name',
  favorites: string[] = [],
  recentUsage: Record<string, number> = {},
): AppEntry[] {
  const favSet = new Set(favorites);
  const list = apps.slice();
  list.sort((a, b) => {
    if (mode === 'favorites') {
      const fa = favSet.has(a.id) ? favorites.indexOf(a.id) : favorites.length + 1;
      const fb = favSet.has(b.id) ? favorites.indexOf(b.id) : favorites.length + 1;
      if (fa !== fb) return fa - fb;
    }
    if (mode === 'recent') {
      const ra = recentUsage[a.id] || 0;
      const rb = recentUsage[b.id] || 0;
      if (ra !== rb) return rb - ra;
    }
    const nameOf = (app: AppEntry) => app.displayName || app.name;
    return nameOf(a).localeCompare(nameOf(b), 'zh-CN');
  });
  return list;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  return ((index % length) + length) % length;
}
