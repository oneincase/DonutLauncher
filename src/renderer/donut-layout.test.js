const test = require('node:test');
const assert = require('node:assert');
const { layoutApps, calculateRingCount } = require('./donut-layout.js');

function fakeApps(count) {
  return Array.from({ length: count }, (_, i) => ({ name: `App ${i}` }));
}

test('layout keeps every icon inside the 720x720 viewBox', () => {
  for (const count of [1, 6, 24, 50, 100, 200]) {
    const layout = layoutApps(fakeApps(count), ['#fff']);
    assert.strictEqual(layout.icons.length, count);
    for (const icon of layout.icons) {
      const edge = layout.iconSize / 2;
      assert.ok(icon.x - edge >= 0 && icon.x + edge <= 720, `x out of bounds (${count} apps)`);
      assert.ok(icon.y - edge >= 0 && icon.y + edge <= 720, `y out of bounds (${count} apps)`);
    }
  }
});

test('fit scale shrinks large layouts but never grows beyond 1', () => {
  assert.strictEqual(layoutApps(fakeApps(2), ['#fff']).fitScale, 1);
  for (const count of [50, 100, 200]) {
    const scale = layoutApps(fakeApps(count), ['#fff']).fitScale;
    assert.ok(scale > 0 && scale < 1, `expected shrink for ${count} apps`);
  }
});

test('ring count grows with app count', () => {
  assert.ok(calculateRingCount(50) > calculateRingCount(24));
  assert.strictEqual(calculateRingCount(0), 2);
});
