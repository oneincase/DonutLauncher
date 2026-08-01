const test = require('node:test');
const assert = require('node:assert');
const { schema } = require('../settings-schema.js');

test('new settings have defaults', () => {
  assert.strictEqual(schema.rotationSpeed.default, 1);
  assert.strictEqual('showSearchBar' in schema, false);
  assert.deepStrictEqual(schema.favorites.default, []);
  assert.strictEqual(schema.sortMode.default, 'name');
  assert.deepStrictEqual(schema.recentUsage.default, {});
  assert.deepStrictEqual(schema.excludedApps.default, []);
});

test('enum fields only allow valid values', () => {
  assert.deepStrictEqual(schema.sortMode.enum, ['name', 'recent', 'favorites']);
});
