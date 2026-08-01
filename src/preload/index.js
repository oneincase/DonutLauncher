const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('donut', {
  getApps: () => ipcRenderer.invoke('donut:getApps'),
  refreshApps: () => ipcRenderer.invoke('donut:refreshApps'),
  launchApp: (appPath) => ipcRenderer.invoke('donut:launchApp', appPath),
  getSettings: () => ipcRenderer.invoke('donut:getSettings'),
  setSettings: (partial) => ipcRenderer.invoke('donut:setSettings', partial),
  hideWindow: () => ipcRenderer.invoke('donut:hideWindow'),
  onShow: (callback) => ipcRenderer.on('donut:show', (_event) => callback()),
});
