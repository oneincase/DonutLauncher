/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logPath = null;

function resolveLogPath() {
  if (!logPath) {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logPath = path.join(dir, 'main.log');
  }
  return logPath;
}

function appendLine(level, args) {
  try {
    const body = args
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');
    fs.appendFileSync(resolveLogPath(), `[${new Date().toISOString()}] [${level}] ${body}\n`);
  } catch {
    // Logging must never break the app.
  }
}

function setupLogger() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => {
    appendLine('log', args);
    origLog(...args);
  };
  console.warn = (...args) => {
    appendLine('warn', args);
    origWarn(...args);
  };
  console.error = (...args) => {
    appendLine('error', args);
    origError(...args);
  };
  process.on('uncaughtException', (err) => {
    appendLine('fatal', [err && err.stack ? err.stack : String(err)]);
  });
  process.on('unhandledRejection', (reason) => {
    appendLine('fatal', [String(reason)]);
  });
}

module.exports = { setupLogger };
