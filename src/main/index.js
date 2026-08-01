const { app, BrowserWindow, globalShortcut, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { registerIpcHandlers, refreshApps, getCachedApps } = require('./ipc-handlers');
const { normalizeViewSize, WINDOW_SCALE } = require('./window-size');
const settings = require('./settings');
const { setupLogger } = require('./logger');

const isDev = process.argv.includes('--dev');
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const WINDOW_SIZE = 900;
const HIDDEN_WINDOW_TTL_MS = 60000;
const TRAY_ICON_PATH = path.join(__dirname, '..', 'public', 'bar.png');
let mainWindow = null;
const mainWindowRef = { current: null };
let currentShortcut = null;
let tray = null;
let hiddenWindowTimer = null;
let pendingOpenSettings = false;
let pendingShowCancelled = false;

function clearHiddenWindowTimer() {
  if (hiddenWindowTimer) {
    clearTimeout(hiddenWindowTimer);
    hiddenWindowTimer = null;
  }
}

function positionOnDisplay(win) {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = display.workArea;
  const size = win.getBounds().width;
  win.setPosition(
    x + Math.round((width - size) / 2),
    y + Math.round((height - size) / 2),
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    type: 'panel',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setWindowButtonVisibility(false);

  mainWindow.on('blur', () => {
    hideWindow();
  });

  mainWindow.on('closed', () => {
    clearHiddenWindowTimer();
    mainWindow = null;
    mainWindowRef.current = null;
    pendingOpenSettings = false;
    pendingShowCancelled = false;
  });

  mainWindowRef.current = mainWindow;
}

function presentWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const excluded = new Set(settings.get('excludedApps') || []);
  const appCount = getCachedApps().filter((app) => !excluded.has(app.name)).length;
  const viewSize = normalizeViewSize(appCount, display.bounds);
  const windowSize = Math.ceil(viewSize * WINDOW_SCALE);
  const bounds = mainWindow.getBounds();
  if (bounds.width !== windowSize || bounds.height !== windowSize) {
    mainWindow.setBounds({ width: windowSize, height: windowSize });
  }
  positionOnDisplay(mainWindow);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('donut:show');
  console.log('[main] Window shown');
}

function showWindow() {
  clearHiddenWindowTimer();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.webContents.isLoading()) {
      return;
    }
    presentWindow();
    return;
  }
  pendingShowCancelled = false;
  createWindow();
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (pendingShowCancelled) {
      pendingShowCancelled = false;
      mainWindow.destroy();
      return;
    }
    presentWindow();
    if (pendingOpenSettings) {
      pendingOpenSettings = false;
      mainWindow.webContents.send('donut:openSettings');
    }
  });
}

function hideWindow() {
  clearHiddenWindowTimer();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isLoading()) {
    pendingShowCancelled = true;
    pendingOpenSettings = false;
    return;
  }
  try {
    mainWindow.webContents.send('donut:hide');
  } catch (err) {
    console.error('[main] Failed to notify renderer about hide:', err.message);
  }
  mainWindow.hide();
  hiddenWindowTimer = setTimeout(() => {
    hiddenWindowTimer = null;
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.destroy();
    }
  }, HIDDEN_WINDOW_TTL_MS);
}

function toggleWindow() {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    (mainWindow.isVisible() || mainWindow.webContents.isLoading())
  ) {
    hideWindow();
  } else {
    showWindow();
  }
}

function openSettings() {
  pendingOpenSettings = true;
  showWindow();
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
    pendingOpenSettings = false;
    mainWindow.webContents.send('donut:openSettings');
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(TRAY_ICON_PATH);
  tray = new Tray(icon.resize({ width: 18, height: 18 }));
  tray.setToolTip('甜甜圈控制台');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => toggleWindow() },
    { label: '打开设置', click: () => openSettings() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
  tray.on('click', () => toggleWindow());
  console.log('[main] Tray created');
}

function registerShortcut() {
  const shortcut = settings.get('shortcut') || 'Option+Space';
  if (shortcut === currentShortcut) return;
  if (!/^[\x20-\x7E]+$/.test(shortcut)) {
    console.error(`Invalid global shortcut: ${shortcut}`);
    sendShortcutError(shortcut);
    return;
  }
  try {
    const registered = globalShortcut.register(shortcut, toggleWindow);
    if (!registered) {
      console.error(`Failed to register global shortcut: ${shortcut}`);
      sendShortcutError(shortcut);
      return;
    }
  } catch (err) {
    console.error(`Failed to register global shortcut: ${shortcut}`, err.message);
    sendShortcutError(shortcut);
    return;
  }
  if (currentShortcut) {
    try {
      globalShortcut.unregister(currentShortcut);
    } catch (err) {
      console.error(`Failed to unregister shortcut: ${currentShortcut}`, err.message);
    }
  }
  currentShortcut = shortcut;
  console.log(`[main] Shortcut registered: ${shortcut}`);
}

function sendShortcutError(shortcut) {
  if (mainWindowRef.current && !mainWindowRef.current.isDestroyed()) {
    mainWindowRef.current.webContents.send('donut:shortcutError', shortcut);
  }
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(async () => {
    setupLogger();
    if (process.argv.includes('--reset-settings')) {
      settings.clear();
      console.log('[main] Settings reset to defaults');
    }
    createTray();
    registerIpcHandlers(hideWindow, () => mainWindowRef.current);
    registerShortcut();
    settings.onDidChange('shortcut', registerShortcut);
    showWindow();
    const apps = await refreshApps();
    console.log(`[main] Scanned ${apps.length} apps`);
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    clearHiddenWindowTimer();
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });

  app.on('window-all-closed', () => {
    // Keep running in background on macOS
  });

  app.on('activate', () => {
    showWindow();
  });
}
