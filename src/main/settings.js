const Store = require('electron-store');
const os = require('os');
const path = require('path');
const { schema } = require('./settings-schema');

const store = new Store({ schema });

function getDefaultScanPaths() {
  return ['/Applications', path.join(os.homedir(), 'Applications')];
}

module.exports = {
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  getAll: () => ({ ...store.store, defaultScanPaths: getDefaultScanPaths() }),
  setAll: (partial) => {
    store.set(partial);
  },
  clear: () => store.clear(),
  onDidChange: (key, callback) => store.onDidChange(key, callback),
};
