/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const Store = require('electron-store');
const os = require('os');
const path = require('path');
const { schema } = require('./settings-schema');

const store = new Store({ schema });

function getDefaultScanPaths() {
  return ['/Applications', path.join(os.homedir(), 'Applications')];
}

function getDefaultCenterIconPath() {
  return path.join(__dirname, '..', 'public', 'center.jpg');
}

module.exports = {
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  getAll: () => ({
    ...store.store,
    defaultScanPaths: getDefaultScanPaths(),
    defaultCenterIconPath: getDefaultCenterIconPath(),
  }),
  setAll: (partial) => {
    store.set(partial);
  },
  clear: () => store.clear(),
  onDidChange: (key, callback) => store.onDidChange(key, callback),
};
