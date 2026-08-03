import type { AppEntry, DonutLayout, Ring } from '../types';

export const BASE_VIEW_SIZE = 720;
export const ICON_SIZE = 48;
export const RING_GAP = 88;
export const INNER_RADIUS = 52;
export const ICONS_PER_RING_BASE = 10;
export const ICONS_PER_RING_STEP = 8;
export const EDGE_MARGIN = 10;
export const LABEL_FONT_SIZE = 10;
export const MAX_RINGS = 3;

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function ringCapacity(ringIndex: number): number {
  return ICONS_PER_RING_BASE + ringIndex * ICONS_PER_RING_STEP;
}

export function totalRingCapacity(ringCount: number): number {
  let total = 0;
  for (let i = 0; i < ringCount; i += 1) total += ringCapacity(i);
  return total;
}

export function calculateRingCount(appCount: number): number {
  let remaining = appCount;
  let ring = 0;
  while (remaining > 0 && ring < MAX_RINGS) {
    ring += 1;
    remaining -= ICONS_PER_RING_BASE + (ring - 1) * ICONS_PER_RING_STEP;
  }
  return Math.max(ring, 2);
}

export function calculatePageCount(appCount: number): number {
  const capacity = totalRingCapacity(MAX_RINGS);
  return Math.max(1, Math.ceil(appCount / capacity));
}

export function paginateApps<T>(apps: T[], page: number): { pageApps: T[]; pageCount: number } {
  const pageCount = calculatePageCount(apps.length);
  const capacity = totalRingCapacity(MAX_RINGS);
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  return {
    pageApps: apps.slice(safePage * capacity, (safePage + 1) * capacity),
    pageCount,
  };
}

export function calculateFitScale(
  ringCount: number,
  viewSize = BASE_VIEW_SIZE,
): number {
  const outermostRadius = INNER_RADIUS + ringCount * RING_GAP;
  const maxRadius = viewSize / 2 - EDGE_MARGIN;
  return Math.min(1, maxRadius / (outermostRadius + ICON_SIZE / 2));
}

export function calculateViewSize(appCount: number): number {
  const ringCount = calculateRingCount(appCount);
  const outermostRadius = INNER_RADIUS + ringCount * RING_GAP;
  const naturalSize = Math.ceil(2 * (outermostRadius + ICON_SIZE / 2 + EDGE_MARGIN));
  return Math.max(BASE_VIEW_SIZE, naturalSize);
}

export function layoutApps(
  apps: AppEntry[],
  ringColors: string[],
  rotationOffset = 0,
  viewSize = BASE_VIEW_SIZE,
): DonutLayout {
  const ringCount = calculateRingCount(apps.length);
  const fitScale = calculateFitScale(ringCount, viewSize);
  const center = viewSize / 2;
  const rings: Ring[] = [];

  for (let i = 0; i < ringCount; i += 1) {
    const radius = (INNER_RADIUS + (i + 1) * RING_GAP) * fitScale;
    const color = ringColors[i % ringColors.length] || '#ffffff';
    rings.push({ radius, color });
  }

  const icons: DonutLayout['icons'] = [];
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
