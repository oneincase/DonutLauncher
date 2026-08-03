export interface AppEntry {
  id: string;
  name: string;
  displayName: string;
  path: string;
  iconDataUrl: string;
}

export interface Settings {
  scanPaths: string[];
  ringColors: string[];
  ringOpacity: number;
  ringStrokeWidth: number;
  shortcut: string;
  centerIconPath: string;
  centerIconSize: number;
  enableRotation: boolean;
  rotationSpeed: number;
  iconScale: number;
  targetFps: number;
  autoCheckUpdate: boolean;
  autoLaunch: boolean;
  favorites: string[];
  sortMode: 'name' | 'recent' | 'favorites';
  recentUsage: Record<string, number>;
  excludedApps: string[];
}

export interface SettingsView extends Settings {
  defaultScanPaths: string[];
  defaultCenterIconPath: string;
  platform: 'macos' | 'windows' | 'linux';
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  hasUpdate: boolean;
  releaseUrl?: string;
  checkedAt?: number;
  error?: string | null;
  notice?: string;
}

export interface LayoutIcon {
  app: AppEntry;
  x: number;
  y: number;
  angle: number;
  ringIndex: number;
}

export interface Ring {
  radius: number;
  color: string;
}

export interface DonutLayout {
  rings: Ring[];
  icons: LayoutIcon[];
  center: number;
  viewSize: number;
  fitScale: number;
  iconSize: number;
  labelFontSize: number;
}
