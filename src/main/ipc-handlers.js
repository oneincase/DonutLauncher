const { ipcMain, dialog, screen } = require('electron');
const { scanApplications } = require('./app-scanner');
const { launchApp } = require('./app-launcher');
const settings = require('./settings');
const { normalizeViewSize, WINDOW_SCALE } = require('./window-size');

let cachedApps = [];

async function refreshApps() {
  cachedApps = await scanApplications();
  return cachedApps;
}

function registerIpcHandlers(hideWindow = () => {}, getMainWindow = () => null) {
  ipcMain.handle('donut:getApps', async () => {
    if (cachedApps.length === 0) {
      cachedApps = await scanApplications();
    }
    return cachedApps;
  });

  ipcMain.handle('donut:refreshApps', async () => {
    return refreshApps();
  });

  ipcMain.handle('donut:launchApp', async (_event, appPath) => {
    launchApp(appPath);
    const appEntry = cachedApps.find((app) => app.path === appPath);
    if (appEntry) {
      const recentUsage = settings.get('recentUsage') || {};
      recentUsage[appEntry.id] = Date.now();
      settings.set('recentUsage', recentUsage);
    }
    hideWindow();
    return { success: true };
  });

  ipcMain.handle('donut:getSettings', async () => {
    return settings.getAll();
  });

  ipcMain.handle('donut:setSettings', async (_event, partial) => {
    settings.setAll(partial);
    return settings.getAll();
  });

  ipcMain.handle('donut:hideWindow', async () => {
    hideWindow();
    return { success: true };
  });

  ipcMain.handle('donut:setWindowSize', (_event, appCount) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    const display = screen.getDisplayMatching(win.getBounds());
    const viewSize = normalizeViewSize(appCount, display.bounds);
    const windowSize = Math.ceil(viewSize * WINDOW_SCALE);
    const bounds = win.getBounds();
    if (bounds.width !== windowSize || bounds.height !== windowSize) {
      const { x, y, width, height } = display.workArea;
      win.setBounds({
        width: windowSize,
        height: windowSize,
        x: x + Math.round((width - windowSize) / 2),
        y: y + Math.round((height - windowSize) / 2),
      });
    }
    return viewSize;
  });

  ipcMain.handle('donut:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

module.exports = {
  registerIpcHandlers,
  refreshApps,
  getCachedApps: () => cachedApps,
};
