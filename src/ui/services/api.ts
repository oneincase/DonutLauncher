import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { AppEntry, SettingsView, UpdateInfo } from '../types';
import { mock } from './mock';
import { checkForUpdate } from './update-service';

export const isMock =
  import.meta.env.VITE_MOCK_TAURI === '1' ||
  !('__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>));

export const api = {
  getApps: (): Promise<AppEntry[]> =>
    isMock ? mock.getApps() : invoke<AppEntry[]>('get_apps'),

  refreshApps: (): Promise<AppEntry[]> =>
    isMock ? mock.refreshApps() : invoke<AppEntry[]>('refresh_apps'),

  launchApp: (appPath: string): Promise<void> =>
    isMock ? mock.launchApp(appPath) : invoke<void>('launch_app', { appPath }),

  getSettings: (): Promise<SettingsView> =>
    isMock ? mock.getSettings() : invoke<SettingsView>('get_settings'),

  setSettings: (partial: Record<string, unknown>): Promise<SettingsView> =>
    isMock ? mock.setSettings(partial) : invoke<SettingsView>('set_settings', { partial }),

  resetSettings: (): Promise<SettingsView> =>
    isMock ? mock.resetSettings() : invoke<SettingsView>('reset_settings'),

  setDialogOpen: (open: boolean): Promise<void> =>
    isMock ? Promise.resolve() : invoke<void>('set_dialog_open', { open }),

  getVersion: (): Promise<string> =>
    isMock ? Promise.resolve('0.0.2') : getVersion(),

  pickFolder: async (): Promise<string | null> => {
    if (isMock) return mock.pickFolder();
    await invoke<void>('set_dialog_open', { open: true });
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      return typeof selected === 'string' ? selected : null;
    } finally {
      await invoke<void>('set_dialog_open', { open: false });
    }
  },

  openExternal: (url: string): Promise<void> => {
    if (isMock) return mock.openExternal();
    return openUrl(url);
  },

  checkUpdate: (currentVersion: string): Promise<UpdateInfo> =>
    isMock ? mock.checkUpdate(currentVersion) : checkForUpdate(currentVersion),

  onEvent(event: string, handler: () => void): () => void {
    if (isMock) return () => undefined;
    const unlistenPromise = listen(event, () => handler());
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  },
};
