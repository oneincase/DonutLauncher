const VIEW_SIZE = 720;

function layoutGrid(apps, options = {}) {
  const iconSize = options.iconSize || 64;
  const gap = options.gap || 16;
  const count = apps.length;
  const cols = count === 0 ? 1 : Math.ceil(Math.sqrt(count));
  const rows = count === 0 ? 1 : Math.ceil(count / cols);
  const cellSize = Math.min(
    (VIEW_SIZE - gap * (cols + 1)) / cols,
    (VIEW_SIZE - gap * (rows + 1)) / rows,
  );
  const icon = Math.max(24, Math.min(iconSize, cellSize - 8));
  const totalWidth = cols * cellSize + (cols - 1) * gap;
  const totalHeight = rows * cellSize + (rows - 1) * gap;
  const startX = (VIEW_SIZE - totalWidth) / 2;
  const startY = (VIEW_SIZE - totalHeight) / 2;

  const items = apps.map((app, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      app,
      x: startX + col * (cellSize + gap) + cellSize / 2,
      y: startY + row * (cellSize + gap) + cellSize / 2,
      index,
    };
  });

  return { items, cols, rows, iconSize: icon, cellSize, gap };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutGrid };
}
