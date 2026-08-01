/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

module.exports = { mapLimit };
