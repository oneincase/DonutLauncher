const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers, refreshApps } = require('../src/main/ipc-handlers');
const settings = require('../src/main/settings');

const INDEX_HTML = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
const PRELOAD = path.join(__dirname, '..', 'src', 'preload', 'index.js');

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function argNumber(name, fallback) {
  const value = argValue(name);
  return value === null ? fallback : Number(value);
}

const outPath = argValue('out') || path.join(__dirname, '..', 'outputs', 'measure.json');
const shownSeconds = argNumber('shown-seconds', 8);
const hiddenSeconds = argNumber('hidden-seconds', 10);
const idleSeconds = argNumber('idle-seconds', 6);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMeasureWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 900,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false,
    },
  });
  win.setWindowButtonVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
}

async function loadMeasureWindow(win) {
  const ready = new Promise((resolve) => win.once('ready-to-show', resolve));
  const start = Date.now();
  await win.loadFile(INDEX_HTML);
  await ready;
  return Date.now() - start;
}

async function waitForIcons(win, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let count = 0;
    try {
      count = await win.webContents.executeJavaScript(
        `document.querySelectorAll('#icons .app-icon').length`,
      );
    } catch {
      return -1;
    }
    if (count > 0) return Date.now() - start;
    await sleep(10);
  }
  return -1;
}

function metricsSnapshot() {
  const metrics = app.getAppMetrics();
  const totals = { rss: 0, cpu: 0 };
  const byType = {};
  for (const metric of metrics) {
    const rss = metric.memory ? metric.memory.workingSetSize : 0;
    const cpu = metric.cpu ? metric.cpu.percentCPUUsage : 0;
    totals.rss += rss;
    totals.cpu += cpu;
    const key = metric.type;
    byType[key] = byType[key] || { count: 0, rss: 0, cpu: 0 };
    byType[key].count += 1;
    byType[key].rss += rss;
    byType[key].cpu += cpu;
  }
  return { totals, byType, at: new Date().toISOString() };
}

async function sampleMetrics(seconds) {
  const samples = [];
  const rounds = Math.max(1, Math.round(seconds));
  for (let i = 0; i < rounds; i += 1) {
    await sleep(1000);
    samples.push(metricsSnapshot());
  }
  const avg = (field) => samples.reduce((sum, sample) => sum + sample.totals[field], 0) / samples.length;
  return {
    rssAvg: avg('rss'),
    rssPeak: Math.max(...samples.map((sample) => sample.totals.rss)),
    cpuAvg: avg('cpu'),
    samples: samples.length,
  };
}

app.on('window-all-closed', () => {
  // Keep the measurement process alive until the flow calls app.quit().
});

app.whenReady().then(async () => {
  const original = settings.getAll();
  settings.setAll({ ...original, enableRotation: true });

  const scanStart = Date.now();
  const apps = await refreshApps();
  const scanMs = Date.now() - scanStart;

  const win = createMeasureWindow();
  registerIpcHandlers(() => win.hide(), () => win);
  const coldLoadMs = await loadMeasureWindow(win);
  await waitForIcons(win, 10000);

  win.webContents.send('donut:hide');
  await sleep(150);
  win.show();
  win.webContents.send('donut:show');
  const warmShowToRenderMs = await waitForIcons(win, 5000);

  const shown = await sampleMetrics(shownSeconds);

  win.webContents.send('donut:hide');
  await sleep(150);
  win.hide();
  const hiddenWithRenderer = await sampleMetrics(hiddenSeconds);

  win.destroy();
  const hiddenNoRenderer = await sampleMetrics(idleSeconds);

  const coldWin = createMeasureWindow();
  const coldLoadMsAfterUnload = await loadMeasureWindow(coldWin);
  await waitForIcons(coldWin, 10000);
  coldWin.webContents.send('donut:hide');
  await sleep(150);
  coldWin.show();
  coldWin.webContents.send('donut:show');
  const coldShowToRenderMs = await waitForIcons(coldWin, 10000);
  coldWin.destroy();

  const result = {
    appCount: apps.length,
    scanMs,
    coldLoadMs,
    coldLoadMsAfterUnload,
    warmShowToRenderMs,
    coldShowToRenderMs,
    shown,
    hiddenWithRenderer,
    hiddenNoRenderer,
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  const mb = (kilobytes) => (kilobytes / 1024).toFixed(1);
  console.log(
    `[measure] apps=${apps.length} scanMs=${scanMs} coldLoadMs=${coldLoadMs} coldLoadMsAfterUnload=${coldLoadMsAfterUnload} warmShowToRenderMs=${warmShowToRenderMs} coldShowToRenderMs=${coldShowToRenderMs}`,
  );
  console.log(`[measure] shown rssAvg=${mb(result.shown.rssAvg)}MB cpuAvg=${result.shown.cpuAvg.toFixed(2)}%`);
  console.log(
    `[measure] hiddenWithRenderer rssAvg=${mb(result.hiddenWithRenderer.rssAvg)}MB cpuAvg=${result.hiddenWithRenderer.cpuAvg.toFixed(2)}%`,
  );
  console.log(`[measure] hiddenNoRenderer rssAvg=${mb(result.hiddenNoRenderer.rssAvg)}MB cpuAvg=${result.hiddenNoRenderer.cpuAvg.toFixed(2)}%`);
  console.log(`[measure] saved=${outPath}`);

  settings.setAll(original);
  app.quit();
}).catch((err) => {
  console.error('[measure] failed', err);
  app.exit(1);
});
