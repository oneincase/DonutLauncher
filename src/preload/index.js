const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('donut', {
  getApps: () => ipcRenderer.invoke('donut:getApps'),
  refreshApps: () => ipcRenderer.invoke('donut:refreshApps'),
  launchApp: (appPath) => ipcRenderer.invoke('donut:launchApp', appPath),
  getSettings: () => ipcRenderer.invoke('donut:getSettings'),
  setSettings: (partial) => ipcRenderer.invoke('donut:setSettings', partial),
  hideWindow: () => ipcRenderer.invoke('donut:hideWindow'),
  pickFolder: () => ipcRenderer.invoke('donut:pickFolder'),
  onShow: (callback) => ipcRenderer.on('donut:show', (_event) => callback()),
  onOpenSettings: (callback) => ipcRenderer.on('donut:openSettings', () => callback()),
  onShortcutError: (callback) => ipcRenderer.on('donut:shortcutError', (_event, shortcut) => callback(shortcut)),
});
