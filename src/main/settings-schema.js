/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
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
    minimum: 1,
    maximum: 50,
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
  centerIconSize: {
    type: 'number',
    minimum: 20,
    maximum: 120,
    default: 56,
  },
  enableRotation: {
    type: 'boolean',
    default: true,
  },
  rotationSpeed: {
    type: 'number',
    minimum: 0,
    maximum: 3,
    default: 1,
  },
  iconScale: {
    type: 'number',
    minimum: 1,
    maximum: 2.5,
    default: 1.25,
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
