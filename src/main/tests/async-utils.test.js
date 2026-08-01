const test = require('node:test');
const assert = require('node:assert');
const { mapLimit } = require('../async-utils');

test('mapLimit preserves input order', async () => {
  const result = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => value * 2);
  assert.deepStrictEqual(result, [2, 4, 6, 8, 10]);
});

test('mapLimit respects the concurrency limit', async () => {
  let active = 0;
  let maxActive = 0;
  const result = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return value;
  });
  assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6]);
  assert.ok(maxActive <= 2);
});

test('mapLimit propagates mapper rejection', async () => {
  await assert.rejects(
    mapLimit([1, 2, 3], 2, async (value) => {
      if (value === 2) throw new Error('boom');
      return value;
    }),
    /boom/,
  );
});

test('mapLimit handles empty input', async () => {
  assert.deepStrictEqual(await mapLimit([], 3, async () => 1), []);
});
