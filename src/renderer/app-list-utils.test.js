const test = require('node:test');
const assert = require('node:assert');
const { filterApps, sortApps, clampIndex } = require('./app-list-utils.js');

const apps = [
  { id: 'a', name: 'Safari' },
  { id: 'b', name: 'Notes' },
  { id: 'c', name: 'Calculator' },
];

test('filter is case-insensitive and supports exclusion', () => {
  assert.deepStrictEqual(filterApps(apps, 'SAF').map((a) => a.id), ['a']);
  assert.deepStrictEqual(filterApps(apps, '', ['Safari']).map((a) => a.id), ['b', 'c']);
  assert.deepStrictEqual(filterApps(apps, 'zzz'), []);
});

test('filter matches and hides localized display names', () => {
  const localized = [
    { id: 'a', name: 'Books', displayName: '图书' },
    { id: 'b', name: 'Notes', displayName: '备忘录' },
  ];
  assert.deepStrictEqual(filterApps(localized, '图书').map((a) => a.id), ['a']);
  assert.deepStrictEqual(filterApps(localized, 'BOOKS').map((a) => a.id), ['a']);
  assert.deepStrictEqual(filterApps(localized, '', ['Books']).map((a) => a.id), ['b']);
  assert.deepStrictEqual(filterApps(localized, '', ['图书']).map((a) => a.id), ['b']);
});

test('sort by name is stable', () => {
  assert.deepStrictEqual(sortApps(apps, 'name').map((a) => a.id), ['c', 'b', 'a']);
});

test('sort by favorites keeps favorites first', () => {
  assert.deepStrictEqual(sortApps(apps, 'favorites', ['b']).map((a) => a.id), ['b', 'c', 'a']);
});

test('sort by recent puts newest first', () => {
  assert.deepStrictEqual(sortApps(apps, 'recent', [], { b: 100, a: 200 }).map((a) => a.id), ['a', 'b', 'c']);
});

test('clampIndex wraps', () => {
  assert.strictEqual(clampIndex(3, 3), 0);
  assert.strictEqual(clampIndex(-1, 3), 2);
  assert.strictEqual(clampIndex(0, 0), -1);
});
