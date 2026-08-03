import type { UpdateInfo } from '../types';

const GITHUB_REPO = {
  owner: 'oneincase',
  name: 'DonutLauncher',
};
const GITHUB_API_BASE_URL = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}`;
const GITHUB_LATEST_RELEASE_URL = `${GITHUB_API_BASE_URL}/releases/latest`;
const GITHUB_TAGS_URL = `${GITHUB_API_BASE_URL}/tags?per_page=5`;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/releases`;
const ALLOWED_EXTERNAL_ORIGINS = new Set(['https://space.bilibili.com', 'https://github.com']);

export function normalizeVersion(version: string): number[] | null {
  const match = String(version || '')
    .replace(/^v/i, '')
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)];
}

function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function cleanTag(tag: string): string {
  return String(tag || '').replace(/^v/i, '');
}

async function fetchJson(url: string): Promise<{ statusCode: number; body: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': `${GITHUB_REPO.name}/${GITHUB_REPO.name}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const body = await response.text();
    return { statusCode: response.status, body };
  } catch (error) {
    return { statusCode: 0, body: String(error) };
  }
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const release = await fetchJson(GITHUB_LATEST_RELEASE_URL);
  if (release.statusCode === 200) {
    try {
      const data = JSON.parse(release.body) as { tag_name?: string; html_url?: string };
      const latestVersion = cleanTag(data.tag_name || '');
      return {
        currentVersion,
        latestVersion,
        hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
        releaseUrl: data.html_url || GITHUB_RELEASES_URL,
        checkedAt: Date.now(),
        error: null,
      };
    } catch {
      return {
        currentVersion,
        hasUpdate: false,
        error: 'GitHub 响应格式异常',
      };
    }
  }
  if (release.statusCode === 0) {
    return {
      currentVersion,
      hasUpdate: false,
      error: `无法连接 GitHub（${release.body}）`,
    };
  }
  if (release.statusCode === 403 || release.statusCode === 429) {
    return {
      currentVersion,
      hasUpdate: false,
      error: `GitHub API 访问受限（HTTP ${release.statusCode}），请稍后重试`,
    };
  }
  if (release.statusCode === 404) {
    const tags = await fetchJson(GITHUB_TAGS_URL);
    if (tags.statusCode === 200) {
      try {
        const data = JSON.parse(tags.body) as Array<{ name?: string }>;
        if (data.length > 0) {
          const latestVersion = cleanTag(data[0].name || '');
          return {
            currentVersion,
            latestVersion,
            hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
            releaseUrl: `https://github.com/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/releases/tag/${encodeURIComponent(data[0].name || '')}`,
            checkedAt: Date.now(),
            error: null,
          };
        }
      } catch {
        // fall through to the generic notice
      }
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
  return {
    currentVersion,
    hasUpdate: false,
    error: `GitHub 检查失败（HTTP ${release.statusCode || '未知'}）`,
  };
}

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !ALLOWED_EXTERNAL_ORIGINS.has(parsed.origin)) return false;
    if (parsed.origin === 'https://github.com') {
      const repoPrefix = `/${GITHUB_REPO.owner}/${GITHUB_REPO.name}`;
      return parsed.pathname === repoPrefix || parsed.pathname.startsWith(`${repoPrefix}/`);
    }
    return true;
  } catch {
    return false;
  }
}
