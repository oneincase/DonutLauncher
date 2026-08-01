function filterApps(apps, query = '', excluded = []) {
  const q = query.trim().toLowerCase();
  const excludedSet = new Set(excluded);
  return apps.filter((app) => {
    if (excludedSet.has(app.name)) return false;
    if (!q) return true;
    return app.name.toLowerCase().includes(q);
  });
}

function sortApps(apps, mode = 'name', favorites = [], recentUsage = {}) {
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
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return list;
}

function clampIndex(index, length) {
  if (length <= 0) return -1;
  return ((index % length) + length) % length;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { filterApps, sortApps, clampIndex };
}
