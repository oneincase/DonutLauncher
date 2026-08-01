/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const BASE_VIEW_SIZE = 720;
const ICON_SIZE = 48;
const RING_GAP = 88;
const INNER_RADIUS = 52;
const ICONS_PER_RING_BASE = 10;
const ICONS_PER_RING_STEP = 8;
const EDGE_MARGIN = 10;
const LABEL_FONT_SIZE = 10;

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function calculateRingCount(appCount) {
  let count = 0;
  let remaining = appCount;
  let ring = 0;
  while (remaining > 0) {
    ring += 1;
    const capacity = ICONS_PER_RING_BASE + (ring - 1) * ICONS_PER_RING_STEP;
    remaining -= capacity;
    count += 1;
  }
  return Math.max(count, 2);
}

function calculateFitScale(ringCount, viewSize = BASE_VIEW_SIZE) {
  const outermostRadius = INNER_RADIUS + ringCount * RING_GAP;
  const maxRadius = viewSize / 2 - EDGE_MARGIN;
  return Math.min(1, maxRadius / (outermostRadius + ICON_SIZE / 2));
}

function calculateViewSize(appCount) {
  const ringCount = calculateRingCount(appCount);
  const outermostRadius = INNER_RADIUS + ringCount * RING_GAP;
  const naturalSize = Math.ceil(2 * (outermostRadius + ICON_SIZE / 2 + EDGE_MARGIN));
  return Math.max(BASE_VIEW_SIZE, naturalSize);
}

function layoutApps(apps, ringColors, rotationOffset = 0, viewSize = BASE_VIEW_SIZE) {
  const ringCount = calculateRingCount(apps.length);
  const fitScale = calculateFitScale(ringCount, viewSize);
  const center = viewSize / 2;
  const rings = [];
  const icons = [];

  for (let i = 0; i < ringCount; i += 1) {
    const radius = (INNER_RADIUS + (i + 1) * RING_GAP) * fitScale;
    const color = ringColors[i % ringColors.length] || '#ffffff';
    rings.push({ radius, color });
  }

  let appIndex = 0;
  for (let ringIndex = 0; ringIndex < ringCount && appIndex < apps.length; ringIndex += 1) {
    const radius = rings[ringIndex].radius;
    const capacity = ICONS_PER_RING_BASE + ringIndex * ICONS_PER_RING_STEP;
    const count = Math.min(capacity, apps.length - appIndex);
    const stepAngle = 360 / count;
    const ringRotation = rotationOffset + (ringIndex % 2 === 0 ? 0 : stepAngle / 2);

    for (let i = 0; i < count; i += 1) {
      const angle = ringRotation + i * stepAngle;
      const pos = polarToCartesian(center, center, radius, angle);
      icons.push({
        app: apps[appIndex],
        x: pos.x,
        y: pos.y,
        angle,
        ringIndex,
      });
      appIndex += 1;
    }
  }

  return {
    rings,
    icons,
    center,
    viewSize,
    fitScale,
    iconSize: ICON_SIZE * fitScale,
    labelFontSize: Math.max(LABEL_FONT_SIZE * fitScale, 7),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutApps, calculateRingCount, calculateViewSize, BASE_VIEW_SIZE, ICON_SIZE };
}
