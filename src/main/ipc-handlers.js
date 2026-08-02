/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
const { app, ipcMain, dialog, screen, shell } = require('electron');
const https = require('https');
const { scanApplications } = require('./app-scanner');
const { launchApp } = require('./app-launcher');
const settings = require('./settings');
const { normalizeViewSize, WINDOW_SCALE } = require('./window-size');

const GITHUB_REPO = {
  owner: 'oneincase',
  name: 'DonutLauncher',
};
const GITHUB_API_BASE_URL = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}`;
const GITHUB_LATEST_RELEASE_URL = `${GITHUB_API_BASE_URL}/releases/latest`;
const GITHUB_TAGS_URL = `${GITHUB_API_BASE_URL}/tags?per_page=5`;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/releases`;
const ALLOWED_EXTERNAL_ORIGINS = new Set(['https://space.bilibili.com', 'https://github.com']);

let cachedApps = [];

function normalizeVersion(version) {
  const match = String(version || '')
    .replace(/^v/i, '')
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [match[1], match[2] || '0', match[3] || '0'].map(Number);
}

function compareVersions(a, b) {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function cleanTag(tag) {
  return String(tag || '').replace(/^v/i, '');
}

function fetchJson(url) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': `${GITHUB_REPO.name}/${app.getVersion()}`,
          Accept: 'application/vnd.github+json',
        },
        timeout: 8000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('error', (error) => done({ networkError: error.message }));
        response.on('data', (chunk) => {
          if (body.length < 1024 * 1024) body += chunk;
        });
        response.on('end', () => {
          done({ statusCode: response.statusCode || 0, body });
        });
      },
    );
    request.on('timeout', () => request.destroy());
    request.on('error', (error) => done({ networkError: error.message }));
  });
}

async function fetchLatestRelease() {
  const result = await fetchJson(GITHUB_LATEST_RELEASE_URL);
  if (result.networkError) return result;
  if (result.statusCode !== 200) return { statusCode: result.statusCode };
  try {
    const data = JSON.parse(result.body);
    return {
      tagName: data.tag_name || '',
      url: data.html_url || GITHUB_RELEASES_URL,
    };
  } catch {
    return { parseError: true };
  }
}

async function fetchLatestTag() {
  const result = await fetchJson(GITHUB_TAGS_URL);
  if (result.networkError) return result;
  if (result.statusCode !== 200) return { statusCode: result.statusCode };
  try {
    const tags = JSON.parse(result.body);
    if (Array.isArray(tags) && tags.length > 0) {
      return { tagName: tags[0].name };
    }
    return { empty: true };
  } catch {
    return { parseError: true };
  }
}

async function checkForUpdateInfo() {
  const currentVersion = app.getVersion();
  const release = await fetchLatestRelease();
  if (release.tagName) {
    const latestVersion = cleanTag(release.tagName);
    return {
      currentVersion,
      latestVersion,
      hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
      releaseUrl: release.url || GITHUB_RELEASES_URL,
      checkedAt: Date.now(),
      error: null,
    };
  }
  if (release.networkError) {
    return {
      currentVersion,
      hasUpdate: false,
      error: `无法连接 GitHub（${release.networkError}）`,
    };
  }
  if (release.parseError) {
    return {
      currentVersion,
      hasUpdate: false,
      error: 'GitHub 响应格式异常',
    };
  }
  if (release.statusCode === 404) {
    const tag = await fetchLatestTag();
    if (tag.tagName) {
      const latestVersion = cleanTag(tag.tagName);
      return {
        currentVersion,
        latestVersion,
        hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
        releaseUrl: `https://github.com/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/releases/tag/${encodeURIComponent(tag.tagName)}`,
        checkedAt: Date.now(),
        error: null,
      };
    }
    if (tag.networkError) {
      return {
        currentVersion,
        hasUpdate: false,
        error: `无法连接 GitHub（${tag.networkError}）`,
      };
    }
    return {
      currentVersion,
      hasUpdate: false,
      notice: 'GitHub 上还没有可用的发布版本',
      releaseUrl: GITHUB_RELEASES_URL,
      checkedAt: Date.now(),
      error: null,
    };
  }
  if (release.statusCode === 403 || release.statusCode === 429) {
    return {
      currentVersion,
      hasUpdate: false,
      error: `GitHub API 访问受限（HTTP ${release.statusCode}），请稍后重试`,
    };
  }
  return {
    currentVersion,
    hasUpdate: false,
    error: `GitHub 检查失败（HTTP ${release.statusCode || '未知'}）`,
  };
}

function isAllowedExternalUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !ALLOWED_EXTERNAL_ORIGINS.has(parsed.origin)) return false;
    if (parsed.origin === 'https://github.com') {
      return parsed.pathname.startsWith(`/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/`);
    }
    return true;
  } catch {
    return false;
  }
}

async function checkForUpdatesAndPrompt(getMainWindow = () => null) {
  const info = await checkForUpdateInfo();
  if (!info.hasUpdate) return;
  const win = getMainWindow();
  const options = {
    type: 'info',
    title: '发现新版本',
    message: `发现新版本 ${info.latestVersion}`,
    detail: `当前版本 ${info.currentVersion}，是否前往 GitHub 下载？`,
    buttons: ['前往下载', '稍后'],
    defaultId: 0,
    cancelId: 1,
  };
  const result = win && !win.isDestroyed()
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  if (result.response === 0 && info.releaseUrl) {
    shell.openExternal(info.releaseUrl);
  }
}

async function refreshApps() {
  cachedApps = await scanApplications();
  return cachedApps;
}

function registerIpcHandlers(hideWindow = () => {}, getMainWindow = () => null) {
  ipcMain.handle('donut:getApps', async () => {
    if (cachedApps.length === 0) {
      cachedApps = await scanApplications();
    }
    return cachedApps;
  });

  ipcMain.handle('donut:refreshApps', async () => {
    return refreshApps();
  });

  ipcMain.handle('donut:launchApp', async (_event, appPath) => {
    launchApp(appPath);
    const appEntry = cachedApps.find((app) => app.path === appPath);
    if (appEntry) {
      const recentUsage = settings.get('recentUsage') || {};
      recentUsage[appEntry.id] = Date.now();
      settings.set('recentUsage', recentUsage);
    }
    hideWindow();
    return { success: true };
  });

  ipcMain.handle('donut:getSettings', async () => {
    return settings.getAll();
  });

  ipcMain.handle('donut:setSettings', async (_event, partial) => {
    settings.setAll(partial);
    return settings.getAll();
  });

  ipcMain.handle('donut:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('donut:checkUpdate', async () => {
    return checkForUpdateInfo();
  });

  ipcMain.handle('donut:openExternal', async (_event, url) => {
    if (!isAllowedExternalUrl(url)) return { success: false };
    shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('donut:hideWindow', async () => {
    hideWindow();
    return { success: true };
  });

  ipcMain.handle('donut:setWindowSize', (_event, appCount) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    const display = screen.getDisplayMatching(win.getBounds());
    const viewSize = normalizeViewSize(appCount, display.bounds);
    const windowSize = Math.ceil(viewSize * WINDOW_SCALE);
    const bounds = win.getBounds();
    if (bounds.width !== windowSize || bounds.height !== windowSize) {
      const { x, y, width, height } = display.workArea;
      win.setBounds({
        width: windowSize,
        height: windowSize,
        x: x + Math.round((width - windowSize) / 2),
        y: y + Math.round((height - windowSize) / 2),
      });
    }
    return viewSize;
  });

  ipcMain.handle('donut:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

module.exports = {
  registerIpcHandlers,
  refreshApps,
  getCachedApps: () => cachedApps,
  checkForUpdatesAndPrompt,
};
