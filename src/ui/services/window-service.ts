import {
  availableMonitors,
  cursorPosition,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from '@tauri-apps/api/window';
import { calculateViewSize } from '../lib/donut-layout';
import { isMock } from './api';

const WINDOW_SCALE = 1.25;
const MIN_WINDOW_SIZE = 900;
const WINDOW_SCREEN_MARGIN = 20;

function desiredWindowSize(viewSize: number, displayWidth: number, displayHeight: number): number {
  const desired = Math.ceil(viewSize * WINDOW_SCALE);
  const maxWindow = Math.max(
    MIN_WINDOW_SIZE,
    Math.min(displayWidth, displayHeight) - WINDOW_SCREEN_MARGIN * 2,
  );
  return Math.max(MIN_WINDOW_SIZE, Math.min(maxWindow, desired));
}

function normalizeViewSize(appCount: number, displayWidth: number, displayHeight: number): number {
  const windowSize = desiredWindowSize(calculateViewSize(appCount), displayWidth, displayHeight);
  return Math.round(windowSize / WINDOW_SCALE);
}

export async function syncWindowSize(appCount: number): Promise<number> {
  const displayWidth = 1920;
  const displayHeight = 1080;
  if (isMock) {
    return normalizeViewSize(appCount, displayWidth, displayHeight);
  }

  const cursor = await cursorPosition();
  const monitors = await availableMonitors();
  let display = monitors[0];
  for (const monitor of monitors) {
    const scale = monitor.scaleFactor;
    const left = monitor.position.x / scale;
    const top = monitor.position.y / scale;
    const right = left + monitor.size.width / scale;
    const bottom = top + monitor.size.height / scale;
    if (cursor.x >= left && cursor.x < right && cursor.y >= top && cursor.y < bottom) {
      display = monitor;
      break;
    }
  }

  const scale = display.scaleFactor;
  const width = display.size.width / scale;
  const height = display.size.height / scale;
  const viewSize = normalizeViewSize(appCount, width, height);
  const windowSize = Math.ceil(viewSize * WINDOW_SCALE);
  const x = display.position.x / scale + Math.round((width - windowSize) / 2);
  const y = display.position.y / scale + Math.round((height - windowSize) / 2);

  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(windowSize, windowSize));
  await win.setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
  return viewSize;
}

export async function hideWindow(): Promise<void> {
  if (!isMock) {
    await getCurrentWindow().hide();
  }
}
