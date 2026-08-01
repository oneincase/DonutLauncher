const Store = require('electron-store');

const schema = {
  scanPaths: {
    type: 'array',
    items: { type: 'string' },
    default: ['/Applications', `${process.env.HOME}/Applications`],
  },
  ringColors: {
    type: 'array',
    items: { type: 'string' },
    default: ['#FF6B9D', '#4ECDC4', '#FFE66D'],
  },
  ringOpacity: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    default: 0.45,
  },
  ringStrokeWidth: {
    type: 'number',
    minimum: 0.5,
    maximum: 6,
    default: 2,
  },
  shortcut: {
    type: 'string',
    default: 'Option+Space',
  },
  centerIconPath: {
    type: 'string',
    default: '',
  },
  enableRotation: {
    type: 'boolean',
    default: true,
  },
};

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
