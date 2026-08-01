const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
const { registerIpcHandlers, refreshApps } = require('./ipc-handlers');
const settings = require('./settings');
const { setupLogger } = require('./logger');

const isDev = process.argv.includes('--dev');

const WINDOW_SIZE = 900;
let mainWindow = null;
const mainWindowRef = { current: null };
let currentShortcut = null;


function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    x: Math.round((width - WINDOW_SIZE) / 2),
    y: Math.round((height - WINDOW_SIZE) / 2),
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
      offscreen: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });
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
    mainWindow = null;
    mainWindowRef.current = null;
  });

  mainWindowRef.current = mainWindow;
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = display.workArea;
  mainWindow.setPosition(
    x + Math.round((width - WINDOW_SIZE) / 2),
    y + Math.round((height - WINDOW_SIZE) / 2),
  );
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('donut:show');
  console.log('[main] Window shown');
}

function hideWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

function toggleWindow() {
  if (mainWindow && mainWindow.isVisible() && !mainWindow.isDestroyed()) {
    hideWindow();
  } else {
    showWindow();
  }
}

function registerShortcut() {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
  }
  const shortcut = settings.get('shortcut') || 'Option+Space';
  currentShortcut = shortcut;
  const registered = globalShortcut.register(shortcut, toggleWindow);
  if (!registered) {
    console.error(`Failed to register global shortcut: ${shortcut}`);
    if (mainWindowRef.current && !mainWindowRef.current.isDestroyed()) {
      mainWindowRef.current.webContents.send('donut:shortcutError', shortcut);
    }
  }
}

app.whenReady().then(async () => {
  setupLogger();
  createWindow();
  registerIpcHandlers(mainWindowRef);
  registerShortcut();
  settings.onDidChange('shortcut', registerShortcut);
  const apps = await refreshApps();
  console.log(`[main] Scanned ${apps.length} apps`);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep running in background on macOS
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
