/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const test = require('node:test');
const assert = require('node:assert');
const { schema } = require('../settings-schema.js');

test('new settings have defaults', () => {
  assert.strictEqual(schema.rotationSpeed.default, 1);
  assert.strictEqual('showSearchBar' in schema, false);
  assert.strictEqual(schema.autoCheckUpdate.default, true);
  assert.deepStrictEqual(schema.favorites.default, []);
  assert.strictEqual(schema.sortMode.default, 'name');
  assert.deepStrictEqual(schema.recentUsage.default, {});
  assert.deepStrictEqual(schema.excludedApps.default, []);
});

test('enum fields only allow valid values', () => {
  assert.deepStrictEqual(schema.sortMode.enum, ['name', 'recent', 'favorites']);
});
