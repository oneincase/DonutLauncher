const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, nativeImage } = require('electron');
const settings = require('./settings');
const { extractBestIconBuffer } = require('./icns-utils');

const ICON_SIZE = 64;
const ICON_CACHE = new Map();

function iconCacheDir() {
  return path.join(app.getPath('userData'), 'icon-cache');
}

function isAppBundle(entryPath) {
  return entryPath.endsWith('.app') && fs.statSync(entryPath).isDirectory();
}

function readPlist(appPath) {
  const infoPath = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(infoPath)) return null;
  try {
    const buffer = fs.readFileSync(infoPath, 'utf8');
    const nameMatch = buffer.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/);
    const altNameMatch = buffer.match(/<key>CFBundleName<\/key>\s*<string>([^<]*)<\/string>/);
    const executableMatch = buffer.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]*)<\/string>/);
    const iconFileMatch = buffer.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]*)<\/string>/);
    return {
      name: (nameMatch && nameMatch[1]) || (altNameMatch && altNameMatch[1]) || path.basename(appPath, '.app'),
      executable: executableMatch && executableMatch[1],
      iconFile: iconFileMatch && iconFileMatch[1],
    };
  } catch {
    return null;
  }
}

function findIconPath(appPath, plist) {
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  if (!fs.existsSync(resourcesPath)) return null;

  const candidates = [];
  const namedIcon = plist.iconFile || plist.name;
  if (namedIcon) {
    const base = path.join(resourcesPath, namedIcon);
    for (const candidate of [base, `${base}.icns`]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        candidates.push(candidate);
      }
    }
  }
  if (candidates.length === 0) {
    try {
      const icnsFiles = fs.readdirSync(resourcesPath).filter((file) => file.endsWith('.icns'));
      candidates.push(...icnsFiles.map((file) => path.join(resourcesPath, file)));
    } catch {
      // Some bundles have no Resources directory or it is not readable.
    }
  }
  if (candidates.length === 0) return null;

  const preferred = candidates.find(
    (candidate) => path.basename(candidate, '.icns').toLowerCase() === (plist.name || '').toLowerCase(),
  );
  if (preferred) return preferred;
  candidates.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  return candidates[0];
}

function iconCacheFileName(appPath, mtimeMs) {
  const hash = crypto.createHash('md5').update(appPath).digest('hex');
  return `${hash}-${Math.round(mtimeMs)}.png`;
}

async function readCachedIcon(cachePath) {
  try {
    const buffer = await fs.promises.readFile(cachePath);
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return '';
    return image.toDataURL();
  } catch {
    return null;
  }
}

async function writeCachedIcon(cachePath, dataUrl) {
  try {
    await fs.promises.mkdir(iconCacheDir(), { recursive: true });
    await fs.promises.writeFile(cachePath, nativeImage.createFromDataURL(dataUrl).toPNG());
  } catch (err) {
    console.error(`[scanner] Icon cache write failed: ${err.message}`);
  }
}

async function iconDataUrlFromIcns(icnsPath) {
  try {
    const buffer = await fs.promises.readFile(icnsPath);
    const pngBuffer = extractBestIconBuffer(buffer);
    if (!pngBuffer) return '';
    const image = nativeImage.createFromBuffer(pngBuffer);
    if (image.isEmpty()) return '';
    const resized = image.resize({ width: ICON_SIZE, height: ICON_SIZE, quality: 'best' });
    return resized.toDataURL();
  } catch {
    return '';
  }
}

async function getIconDataUrl(appPath, plist) {
  if (ICON_CACHE.has(appPath)) return ICON_CACHE.get(appPath);

  const icnsPath = findIconPath(appPath, plist);
  let cachePath = null;
  if (icnsPath) {
    try {
      const stat = await fs.promises.stat(icnsPath);
      cachePath = path.join(iconCacheDir(), iconCacheFileName(appPath, stat.mtimeMs));
    } catch {
      cachePath = null;
    }
  }
  if (cachePath) {
    const cached = await readCachedIcon(cachePath);
    if (cached) {
      ICON_CACHE.set(appPath, cached);
      return cached;
    }
  }

  let dataUrl = '';
  if (icnsPath) {
    dataUrl = await iconDataUrlFromIcns(icnsPath);
  }
  if (!dataUrl) {
    try {
      dataUrl = (await app.getFileIcon(appPath, { size: ICON_SIZE })).toDataURL();
    } catch (err) {
      console.error(`[scanner] getFileIcon failed for ${appPath}:`, err.message);
    }
  }
  if (dataUrl && cachePath) {
    await writeCachedIcon(cachePath, dataUrl);
  }
  ICON_CACHE.set(appPath, dataUrl);
  return dataUrl;
}

function* walkApps(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && isAppBundle(fullPath)) {
      yield fullPath;
      continue;
    }
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      yield* walkApps(fullPath);
    }
  }
}

async function scanApplications() {
  const scanPaths = settings.get('scanPaths');
  const seen = new Set();
  const apps = [];

  for (const scanPath of scanPaths) {
    try {
      for (const appPath of walkApps(scanPath)) {
        const realPath = fs.realpathSync(appPath);
        if (seen.has(realPath)) continue;
        seen.add(realPath);

        const plist = readPlist(realPath);
        if (!plist) continue;

        const iconDataUrl = await getIconDataUrl(realPath, plist);
        apps.push({
          id: Buffer.from(realPath).toString('base64'),
          name: plist.name,
          path: realPath,
          iconDataUrl,
        });
      }
    } catch (err) {
      console.error(`Scan failed for ${scanPath}:`, err.message);
    }
  }

  apps.sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}

module.exports = { scanApplications };
