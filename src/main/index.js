const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers, refreshApps } = require('./ipc-handlers');
const settings = require('./settings');

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
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setPosition(Math.round((width - WINDOW_SIZE) / 2), Math.round((height - WINDOW_SIZE) / 2));
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
  }
}

app.whenReady().then(async () => {
  createWindow();
  registerIpcHandlers(mainWindowRef);
  registerShortcut();
  settings.onDidChange('shortcut', registerShortcut);
  const apps = await refreshApps();
  console.log(`[main] Scanned ${apps.length} apps`);

  // Dev-only: DONUT_CAPTURE=/path/to.png captures a frame, then quits.
  const capturePath = process.env.DONUT_CAPTURE;
  if (capturePath) {
    setTimeout(async () => {
      showWindow();
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const image = await mainWindow.capturePage();
        fs.writeFileSync(capturePath, image.toPNG());
        console.log(`[main] Capture saved to ${capturePath}`);
      } catch (err) {
        console.error('[main] Capture failed:', err.message);
      }
      app.quit();
    }, 1200);
  }
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
