import type { AppEntry, SettingsView, UpdateInfo } from '../types';

const MOCK_APPS: AppEntry[] = [
  'Safari',
  '备忘录',
  '计算器',
  '邮件',
  '信息',
  '音乐',
  '照片',
  '地图',
  '图书',
  '系统设置',
  '终端',
  '预览',
  '日历',
  '通讯录',
  '字体册',
  '磁盘工具',
  '活动监视器',
  '控制台',
  '快捷指令',
  '截屏',
  '提醒事项',
  '股市',
  '天气',
  '语音备忘录',
  '时钟',
  '词典',
  'FaceTime',
  '播客',
].map((displayName, index) => ({
  id: btoa(`/Applications/Mock${index}.app`),
  name: `Mock App ${index + 1}`,
  displayName,
  path: `/Applications/Mock ${displayName}.app`,
  iconDataUrl: '',
}));

function defaultSettings(): SettingsView {
  return {
    scanPaths: ['/Applications', '/Users/example/Applications'],
    defaultScanPaths: ['/Applications', '/Users/example/Applications'],
    defaultCenterIconPath: '/center.jpg',
    platform: 'macos',
    ringColors: ['#FF6B9D', '#4ECDC4', '#FFE66D'],
    ringOpacity: 0.45,
    ringStrokeWidth: 2,
    shortcut: 'Option+Space',
    centerIconPath: '',
    centerIconSize: 56,
    enableRotation: true,
    rotationSpeed: 1,
    iconScale: 1.25,
    targetFps: 60,
    autoCheckUpdate: true,
    autoLaunch: false,
    favorites: [],
    sortMode: 'name',
    recentUsage: {},
    excludedApps: [],
  };
}

let settings = defaultSettings();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const mock = {
  async getApps(): Promise<AppEntry[]> {
    return clone(MOCK_APPS);
  },
  async refreshApps(): Promise<AppEntry[]> {
    return clone(MOCK_APPS);
  },
  async launchApp(_path: string): Promise<void> {
    return undefined;
  },
  async getSettings(): Promise<SettingsView> {
    return clone(settings);
  },
  async setSettings(partial: Record<string, unknown>): Promise<SettingsView> {
    settings = { ...settings, ...partial };
    return clone(settings);
  },
  async resetSettings(): Promise<SettingsView> {
    settings = defaultSettings();
    return clone(settings);
  },
  async pickFolder(): Promise<string | null> {
    return '/Applications';
  },
  async openExternal(): Promise<void> {
    return undefined;
  },
  async checkUpdate(currentVersion: string): Promise<UpdateInfo> {
    return {
      currentVersion,
      hasUpdate: false,
      checkedAt: Date.now(),
      error: null,
    };
  },
};
