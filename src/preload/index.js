/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('donut', {
  getApps: () => ipcRenderer.invoke('donut:getApps'),
  refreshApps: () => ipcRenderer.invoke('donut:refreshApps'),
  launchApp: (appPath) => ipcRenderer.invoke('donut:launchApp', appPath),
  getSettings: () => ipcRenderer.invoke('donut:getSettings'),
  setSettings: (partial) => ipcRenderer.invoke('donut:setSettings', partial),
  hideWindow: () => ipcRenderer.invoke('donut:hideWindow'),
  setWindowSize: (appCount) => ipcRenderer.invoke('donut:setWindowSize', appCount),
  pickFolder: () => ipcRenderer.invoke('donut:pickFolder'),
  onShow: (callback) => ipcRenderer.on('donut:show', (_event) => callback()),
  onHide: (callback) => ipcRenderer.on('donut:hide', () => callback()),
  onOpenSettings: (callback) => ipcRenderer.on('donut:openSettings', () => callback()),
  onShortcutError: (callback) => ipcRenderer.on('donut:shortcutError', (_event, shortcut) => callback(shortcut)),
});
