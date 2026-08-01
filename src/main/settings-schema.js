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
  layoutMode: {
    type: 'string',
    enum: ['ring', 'grid', 'list'],
    default: 'ring',
  },
  iconSize: {
    type: 'number',
    minimum: 32,
    maximum: 96,
    default: 64,
  },
  rotationSpeed: {
    type: 'number',
    minimum: 0,
    maximum: 3,
    default: 1,
  },
  showSearchBar: {
    type: 'boolean',
    default: true,
  },
  favorites: {
    type: 'array',
    items: { type: 'string' },
    default: [],
  },
  sortMode: {
    type: 'string',
    enum: ['name', 'recent', 'favorites'],
    default: 'name',
  },
  recentUsage: {
    type: 'object',
    default: {},
  },
  excludedApps: {
    type: 'array',
    items: { type: 'string' },
    default: [],
  },
};

module.exports = { schema };
