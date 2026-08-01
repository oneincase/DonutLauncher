const test = require('node:test');
const assert = require('node:assert');
const { layoutApps, calculateRingCount, calculateViewSize } = require('./donut-layout.js');

function fakeApps(count) {
  return Array.from({ length: count }, (_, i) => ({ name: `App ${i}` }));
}

test('layout keeps every icon inside the dynamic viewBox', () => {
  for (const count of [1, 6, 24, 50, 100, 200]) {
    const viewSize = calculateViewSize(count);
    const layout = layoutApps(fakeApps(count), ['#fff'], 0, viewSize);
    assert.strictEqual(layout.icons.length, count);
    for (const icon of layout.icons) {
      const edge = layout.iconSize / 2;
      assert.ok(icon.x - edge >= 0 && icon.x + edge <= viewSize, `x out of bounds (${count} apps)`);
      assert.ok(icon.y - edge >= 0 && icon.y + edge <= viewSize, `y out of bounds (${count} apps)`);
    }
  }
});

test('fit scale stays at 1 when the viewBox grows with app count', () => {
  assert.strictEqual(layoutApps(fakeApps(2), ['#fff']).fitScale, 1);
  for (const count of [50, 100, 200]) {
    const viewSize = calculateViewSize(count);
    assert.strictEqual(layoutApps(fakeApps(count), ['#fff'], 0, viewSize).fitScale, 1);
  }
});

test('fit scale shrinks when the viewBox is smaller than the natural size', () => {
  const count = 100;
  const naturalSize = calculateViewSize(count);
  const scale = layoutApps(fakeApps(count), ['#fff'], 0, naturalSize - 200).fitScale;
  assert.ok(scale > 0 && scale < 1);
});

test('view size grows with app count and never goes below the base size', () => {
  assert.strictEqual(calculateViewSize(0), 720);
  assert.strictEqual(calculateViewSize(50), 720);
  assert.ok(calculateViewSize(200) > calculateViewSize(100));
});

test('ring count grows with app count', () => {
  assert.ok(calculateRingCount(50) > calculateRingCount(24));
  assert.strictEqual(calculateRingCount(0), 2);
});
