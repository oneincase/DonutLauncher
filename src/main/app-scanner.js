const fs = require('fs');
const path = require('path');
const icnsLib = require('icns-lib');
const { app, nativeImage } = require('electron');
const { promisify } = require('util');
const { execFile } = require('child_process');
const settings = require('./settings');

const execFileAsync = promisify(execFile);

const ICON_SIZE = 64;
const ICON_CACHE = new Map();

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

function iconDataUrlFromIcns(icnsPath) {
  try {
    const icons = icnsLib.parse(fs.readFileSync(icnsPath));
    const preferredTypes = ['ic10', 'ic14', 'ic09', 'ic13', 'ic08', 'ic12', 'ic07', 'icp6', 'ic11', 'icp5', 'icp4'];
    let pngBuffer = null;
    for (const type of preferredTypes) {
      if (icons[type] && icons[type].length > 0) {
        pngBuffer = icons[type];
        break;
      }
    }
    if (!pngBuffer) {
      const candidates = Object.keys(icons)
        .filter((type) => icnsLib.isImageType(type))
        .sort((a, b) => icons[b].length - icons[a].length);
      if (candidates.length > 0) {
        pngBuffer = icons[candidates[0]];
      }
    }
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

  let dataUrl = '';
  const icnsPath = findIconPath(appPath, plist);
  if (icnsPath) {
    dataUrl = iconDataUrlFromIcns(icnsPath);
  }
  if (!dataUrl) {
    try {
      dataUrl = (await app.getFileIcon(appPath, { size: ICON_SIZE })).toDataURL();
    } catch (err) {
      console.error(`[scanner] getFileIcon failed for ${appPath}:`, err.message);
    }
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
