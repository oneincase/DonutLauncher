/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const { spawn } = require('child_process');
const path = require('path');

function launchApp(appPath) {
  const normalized = path.normalize(appPath);
  const child = spawn('open', [normalized], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return { success: true };
}

module.exports = { launchApp };
