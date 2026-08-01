/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');
const { app, nativeImage } = require('electron');
const settings = require('./settings');
const { extractBestIconBuffer } = require('./icns-utils');
const { mapLimit } = require('./async-utils');

const DEFAULT_SCAN_PATHS = ['/Applications', path.join(os.homedir(), 'Applications')];
const ICON_SIZE = 64;
const ICON_CONCURRENCY = 8;
const ICON_CACHE_VERSION = 2;
const ICON_CACHE = new Map();
const CHINESE_LPROJ_PRIORITY = ['zh-Hans', 'zh-Hant', 'zh-CN', 'zh-TW', 'zh_CN', 'zh_TW', 'zh'];
const SYSTEM_APP_CHINESE_NAMES = {
  'Activity Monitor': '活动监视器',
  'AirPort Utility': '无线网络实用工具',
  'App Store': 'App Store',
  'Audio MIDI Setup': '音频 MIDI 设置',
  Automator: '自动操作',
  'Bluetooth File Exchange': '蓝牙文件交换',
  Books: '图书',
  'Boot Camp Assistant': 'Boot Camp 助理',
  Calculator: '计算器',
  Calendar: '日历',
  Chess: '国际象棋',
  Clock: '时钟',
  'ColorSync Utility': 'ColorSync 实用工具',
  Console: '控制台',
  Contacts: '通讯录',
  Dictionary: '词典',
  'Digital Color Meter': '数码测色计',
  'Disk Utility': '磁盘工具',
  FaceTime: 'FaceTime 通话',
  FindMy: '查找',
  'Font Book': '字体册',
  Freeform: '无边记',
  Grapher: 'Grapher',
  Home: '家庭',
  'Image Capture': '图像捕捉',
  'Image Playground': '图像游乐场',
  'iPhone Mirroring': 'iPhone 镜像',
  Journal: '手记',
  Magnifier: '放大器',
  Mail: '邮件',
  Maps: '地图',
  Messages: '信息',
  'Migration Assistant': '迁移助理',
  'Mission Control': '调度中心',
  Music: '音乐',
  News: '新闻',
  Notes: '备忘录',
  Passwords: '密码',
  Phone: '电话',
  'Photo Booth': 'Photo Booth',
  Photos: '照片',
  Podcasts: '播客',
  Preview: '预览',
  'Print Center': '打印中心',
  'QuickTime Player': 'QuickTime Player',
  Reminders: '提醒事项',
  'Screen Sharing': '屏幕共享',
  Screenshot: '截屏',
  'Script Editor': '脚本编辑器',
  Shortcuts: '快捷指令',
  Siri: 'Siri',
  Stickies: '便笺',
  Stocks: '股市',
  'System Information': '系统信息',
  'System Settings': '系统设置',
  TV: '电视',
  Terminal: '终端',
  TextEdit: '文本编辑',
  'Time Machine': '时间机器',
  Tips: '使用技巧',
  VoiceMemos: '语音备忘录',
  'VoiceOver Utility': '旁白实用工具',
  Weather: '天气',
};

function isSystemAppPath(appPath) {
  return (
    appPath.startsWith('/System/Applications/') ||
    appPath.startsWith('/System/Cryptexes/App/System/Applications/')
  );
}

function iconCacheDir() {
  return path.join(app.getPath('userData'), 'icon-cache');
}

function isAppBundle(entryPath) {
  if (!entryPath.endsWith('.app')) return false;
  try {
    return fs.statSync(entryPath).isDirectory();
  } catch {
    return false;
  }
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parsePlistText(text) {
  const nameMatch = text.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/);
  const altNameMatch = text.match(/<key>CFBundleName<\/key>\s*<string>([^<]*)<\/string>/);
  const executableMatch = text.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]*)<\/string>/);
  const iconFileMatch = text.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]*)<\/string>/);
  if (!nameMatch && !altNameMatch && !executableMatch && !iconFileMatch) return null;
  return {
    name: decodeXmlEntities((nameMatch && nameMatch[1]) || (altNameMatch && altNameMatch[1]) || ''),
    executable: executableMatch && executableMatch[1],
    iconFile: iconFileMatch && iconFileMatch[1],
  };
}

function readLocalizedName(appPath) {
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  for (const locale of CHINESE_LPROJ_PRIORITY) {
    const stringsPath = path.join(resourcesPath, `${locale}.lproj`, 'InfoPlist.strings');
    if (!fs.existsSync(stringsPath)) continue;
    try {
      const xml = execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', stringsPath], {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      });
      const parsed = parsePlistText(xml);
      if (parsed && parsed.name) return parsed.name;
    } catch {
      // Try the next Chinese locale.
    }
  }
  return null;
}

function readPlist(appPath) {
  const infoPath = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(infoPath)) return null;
  let raw;
  try {
    raw = fs.readFileSync(infoPath);
  } catch {
    return null;
  }
  let parsed = parsePlistText(raw.toString('utf8'));
  if (!parsed) {
    try {
      const xml = execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', infoPath], {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      });
      parsed = parsePlistText(xml);
    } catch {
      parsed = null;
    }
  }
  const name = (parsed && parsed.name) || path.basename(appPath, '.app');
  const localizedName = readLocalizedName(appPath);
  const systemName = isSystemAppPath(appPath) ? SYSTEM_APP_CHINESE_NAMES[name] : null;
  return {
    name,
    displayName: localizedName || systemName || name,
    executable: parsed && parsed.executable,
    iconFile: parsed && parsed.iconFile,
  };
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
  return `v${ICON_CACHE_VERSION}-${hash}-${Math.round(mtimeMs)}.png`;
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
    const pngBuffer = await extractBestIconBuffer(buffer);
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
  if (dataUrl) {
    ICON_CACHE.set(appPath, dataUrl);
  }
  return dataUrl;
}

function* walkApps(dir, seenDirs = new Set()) {
  if (!fs.existsSync(dir)) return;
  let realDir;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    return;
  }
  if (seenDirs.has(realDir)) return;
  seenDirs.add(realDir);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    let isDir = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDir = fs.statSync(fullPath).isDirectory();
      } catch {
        continue;
      }
    }
    if (!isDir) continue;
    if (isDir && isAppBundle(fullPath)) {
      yield fullPath;
      continue;
    }
    yield* walkApps(fullPath, seenDirs);
  }
}

async function scanApplications() {
  const storedPaths = settings.get('scanPaths') || [];
  const scanPaths = [...new Set([...DEFAULT_SCAN_PATHS, ...storedPaths])];
  const seen = new Set();
  const apps = [];

  for (const scanPath of scanPaths) {
    try {
      const candidates = [];
      for (const appPath of walkApps(scanPath)) {
        const realPath = fs.realpathSync(appPath);
        if (seen.has(realPath)) continue;
        seen.add(realPath);

        const plist = readPlist(realPath);
        if (!plist) continue;

        candidates.push({ realPath, plist });
      }

      const iconDataUrls = await mapLimit(candidates, ICON_CONCURRENCY, (candidate) =>
        getIconDataUrl(candidate.realPath, candidate.plist),
      );
      candidates.forEach((candidate, index) => {
        apps.push({
          id: Buffer.from(candidate.realPath).toString('base64'),
          name: candidate.plist.name,
          displayName: candidate.plist.displayName,
          path: candidate.realPath,
          iconDataUrl: iconDataUrls[index],
        });
      });
    } catch (err) {
      console.error(`Scan failed for ${scanPath}:`, err.message);
    }
  }

  apps.sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}

module.exports = { scanApplications };
