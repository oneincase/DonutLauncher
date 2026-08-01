const { calculateViewSize } = require('../renderer/donut-layout');

const WINDOW_SCALE = 1.25;
const MIN_WINDOW_SIZE = 900;
const WINDOW_SCREEN_MARGIN = 20;

function desiredWindowSize(viewSize, displayBounds) {
  const desired = Math.ceil(viewSize * WINDOW_SCALE);
  const maxWindow = Math.max(
    MIN_WINDOW_SIZE,
    Math.min(displayBounds.width, displayBounds.height) - WINDOW_SCREEN_MARGIN * 2,
  );
  return Math.max(MIN_WINDOW_SIZE, Math.min(maxWindow, desired));
}

function normalizeViewSize(appCount, displayBounds) {
  const windowSize = desiredWindowSize(calculateViewSize(Number(appCount) || 0), displayBounds);
  return Math.round(windowSize / WINDOW_SCALE);
}

module.exports = { WINDOW_SCALE, MIN_WINDOW_SIZE, desiredWindowSize, normalizeViewSize };
