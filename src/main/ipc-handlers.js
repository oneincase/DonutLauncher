const { ipcMain, dialog } = require('electron');
const { scanApplications } = require('./app-scanner');
const { launchApp } = require('./app-launcher');
const settings = require('./settings');

let cachedApps = [];

async function refreshApps() {
  cachedApps = await scanApplications();
  return cachedApps;
}

function registerIpcHandlers(mainWindowRef) {
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
    if (mainWindowRef.current) {
      mainWindowRef.current.hide();
    }
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
    if (mainWindowRef.current) {
      mainWindowRef.current.hide();
    }
    return { success: true };
  });

  ipcMain.handle('donut:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

module.exports = { registerIpcHandlers, refreshApps };
