const Store = require('electron-store');
const { schema } = require('./settings-schema');

const store = new Store({ schema });

module.exports = {
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  getAll: () => store.store,
  setAll: (partial) => {
    store.set(partial);
  },
  onDidChange: (key, callback) => store.onDidChange(key, callback),
};
