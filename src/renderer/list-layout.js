const VIEW_SIZE = 720;

function layoutList(apps, options = {}) {
  const iconSize = options.iconSize || 48;
  const rowHeight = options.rowHeight || Math.max(iconSize + 16, 48);
  const count = apps.length;
  const visibleRows = Math.max(1, Math.floor((VIEW_SIZE - 24) / rowHeight));
  const startY = 24;
  const items = apps.map((app, index) => ({
    app,
    x: 0,
    y: startY + index * rowHeight,
    index,
  }));

  return {
    items,
    rowHeight,
    visibleRows,
    totalHeight: startY + Math.max(count, 1) * rowHeight,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutList };
}
