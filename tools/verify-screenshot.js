const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers, refreshApps } = require('../src/main/ipc-handlers');
const settings = require('../src/main/settings');

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const outPath = argValue('out') || path.join(__dirname, '..', 'work', 'verify-ring.png');
const keepRotation = process.argv.includes('--rotate');

app.whenReady().then(async () => {
  const original = settings.getAll();
  settings.setAll({ ...original, enableRotation: keepRotation ? (original.enableRotation ?? true) : false });

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
      preload: path.join(__dirname, '..', 'src', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setWindowButtonVisibility(false);
  registerIpcHandlers(() => win.hide(), () => win);
  await refreshApps();
  await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await new Promise((r) => setTimeout(r, 800));
  win.show();
  await new Promise((r) => setTimeout(r, 2200));

  const counts = await win.webContents.executeJavaScript(`({
    ring: document.querySelectorAll('#icons .app-icon').length,
    searchVisible: !document.getElementById('search-input').classList.contains('hidden'),
  })`);
  const image = await win.capturePage();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, image.toPNG());
  console.log(`[verify] counts=${JSON.stringify(counts)} saved=${outPath}`);

  settings.setAll(original);
  app.quit();
});
