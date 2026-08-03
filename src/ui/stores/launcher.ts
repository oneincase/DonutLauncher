import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { AppEntry, Settings, SettingsView, UpdateInfo } from '../types';
import { clampIndex, filterApps, sortApps } from '../lib/app-list-utils';
import { DEFAULT_COLORS } from '../lib/color-utils';
import { buildAccelerator } from '../lib/shortcut-utils';
import { calculatePageCount, paginateApps } from '../lib/donut-layout';
import { api } from '../services/api';
import { hideWindow, syncWindowSize } from '../services/window-service';
import { checkForUpdate, isAllowedExternalUrl } from '../services/update-service';

export const useLauncherStore = defineStore('launcher', () => {
  const apps = ref<AppEntry[]>([]);
  const settings = ref<SettingsView | null>(null);
  const draft = ref<SettingsView | null>(null);
  const searchQuery = ref('');
  const selectedIndex = ref(0);
  const viewSize = ref(720);
  const searchVisible = ref(false);
  const isSettingsOpen = ref(false);
  const windowHidden = ref(false);
  const version = ref('0.0.0');
  const latestUpdateInfo = ref<UpdateInfo | null>(null);
  const shortcutError = ref('');
  const recordingShortcut = ref(false);
  const shortcutDraft = ref('Option+Space');
  const ringColorsList = ref<string[]>([...DEFAULT_COLORS]);

  const visibleApps = computed(() => {
    const current = settings.value;
    if (!current) return [];
    return sortApps(
      filterApps(apps.value, searchQuery.value, current.excludedApps),
      current.sortMode,
      current.favorites,
      current.recentUsage,
    );
  });

  const currentPage = ref(0);

  const pageCount = computed(() => calculatePageCount(visibleApps.value.length));

  const pageApps = computed(() => paginateApps(visibleApps.value, currentPage.value).pageApps);

  const visibleAppCount = computed(() => {
    const excluded = new Set(settings.value?.excludedApps || []);
    return apps.value.filter((app) => !excluded.has(app.name)).length;
  });

  function goToPage(page: number) {
    currentPage.value = Math.min(Math.max(page, 0), pageCount.value - 1);
    selectedIndex.value = 0;
  }

  function nextPage() {
    if (currentPage.value < pageCount.value - 1) goToPage(currentPage.value + 1);
  }

  function prevPage() {
    if (currentPage.value > 0) goToPage(currentPage.value - 1);
  }

  function setSettings(next: SettingsView) {
    settings.value = next;
    ringColorsList.value = next.ringColors.length ? [...next.ringColors] : [...DEFAULT_COLORS];
  }

  async function loadSettings() {
    setSettings(await api.getSettings());
    version.value = await api.getVersion();
  }

  async function loadApps() {
    apps.value = await api.getApps();
    await syncViewSize();
  }

  async function refreshApps() {
    apps.value = await api.refreshApps();
    await syncViewSize();
  }

  async function syncViewSize() {
    const size = await syncWindowSize(visibleAppCount.value);
    if (size > 0) viewSize.value = size;
  }

  async function init() {
    await loadSettings();
    await loadApps();
    if (settings.value?.autoCheckUpdate) {
      void checkUpdates();
    }
  }

  async function saveSettings(partial: Partial<Settings>) {
    setSettings(await api.setSettings(partial));
  }

  function setSearch(query: string) {
    searchQuery.value = query;
    selectedIndex.value = 0;
  }

  function toggleSearch() {
    searchVisible.value = !searchVisible.value;
    if (!searchVisible.value) {
      searchQuery.value = '';
      selectedIndex.value = 0;
    }
  }

  function moveSelection(dx: number, dy: number) {
    if (pageApps.value.length === 0) return;
    selectedIndex.value = clampIndex(
      selectedIndex.value + (dy !== 0 ? dy : dx),
      pageApps.value.length,
    );
  }

  function launchSelected() {
    const app = pageApps.value[selectedIndex.value];
    if (app) void launchApp(app.path);
  }

  async function launchApp(path: string) {
    await api.launchApp(path);
    await loadSettings();
    await hideWindow();
  }

  async function toggleFavorite(app: AppEntry) {
    const favorites = settings.value?.favorites || [];
    const next = favorites.includes(app.id)
      ? favorites.filter((id) => id !== app.id)
      : [...favorites, app.id];
    await saveSettings({ favorites: next });
  }

  async function toggleHide(app: AppEntry) {
    const excluded = settings.value?.excludedApps || [];
    const next = excluded.includes(app.name)
      ? excluded.filter((name) => name !== app.name)
      : [...excluded, app.name];
    await saveSettings({ excludedApps: next });
    await refreshApps();
  }

  async function unhideApp(name: string) {
    const excluded = (settings.value?.excludedApps || []).filter((item) => item !== name);
    await saveSettings({ excludedApps: excluded });
    await refreshApps();
  }

  async function unhideAll() {
    await saveSettings({ excludedApps: [] });
    await refreshApps();
  }

  function openSettings() {
    if (!settings.value) return;
    draft.value = JSON.parse(JSON.stringify(settings.value)) as SettingsView;
    shortcutDraft.value = settings.value.shortcut || 'Option+Space';
    shortcutError.value = '';
    isSettingsOpen.value = true;
  }

  function closeSettings() {
    draft.value = null;
    isSettingsOpen.value = false;
  }

  async function commitAndClose() {
    if (!draft.value) return;
    const { defaultScanPaths: _defaultPaths, defaultCenterIconPath: _defaultIcon, ...partial } = draft.value;
    await saveSettings(partial);
    await refreshApps();
    closeSettings();
  }

  function addRingColor(color: string) {
    if (!draft.value) return;
    if (!draft.value.ringColors.includes(color)) {
      draft.value.ringColors.push(color);
    }
  }

  function removeRingColor(index: number) {
    if (!draft.value) return;
    draft.value.ringColors.splice(index, 1);
  }

  function moveRingColor(from: number, to: number) {
    if (!draft.value || from === to) return;
    const colors = draft.value.ringColors;
    const [moved] = colors.splice(from, 1);
    const insertAt = from < to ? to - 1 : to;
    colors.splice(insertAt, 0, moved);
  }

  async function addScanPath() {
    if (!draft.value) return;
    const folder = await api.pickFolder();
    if (!folder) return;
    const defaults = draft.value.defaultScanPaths || [];
    const custom = draft.value.scanPaths.filter((path) => !defaults.includes(path));
    if (!custom.includes(folder)) {
      custom.push(folder);
      draft.value.scanPaths = [...defaults, ...custom];
    }
  }

  function removeScanPath(folder: string) {
    if (!draft.value) return;
    const defaults = draft.value.defaultScanPaths || [];
    draft.value.scanPaths = draft.value.scanPaths.filter(
      (path) => !defaults.includes(path) && path !== folder,
    );
  }

  async function pickCenterIcon(file: File) {
    if (!draft.value) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    draft.value.centerIconPath = dataUrl;
  }

  function resetCenterIcon() {
    if (draft.value) draft.value.centerIconPath = '';
  }

  function recordShortcut(event: KeyboardEvent) {
    if (!recordingShortcut.value) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      recordingShortcut.value = false;
      return;
    }
    const accelerator = buildAccelerator(event);
    if (!accelerator) {
      shortcutError.value = '该按键不支持，请使用字母、数字或功能键';
      return;
    }
    shortcutDraft.value = accelerator;
    if (draft.value) {
      draft.value.shortcut = accelerator;
    }
    recordingShortcut.value = false;
    shortcutError.value = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (recordingShortcut.value) {
      recordShortcut(event);
      return;
    }
    if (isSettingsOpen.value) {
      if (event.key === 'Escape') closeSettings();
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        moveSelection(1, 0);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveSelection(-1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveSelection(0, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveSelection(0, -1);
        break;
      case 'Enter':
        event.preventDefault();
        launchSelected();
        break;
      case 'Escape':
        event.preventDefault();
        void hideWindow();
        break;
      default:
        break;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      toggleSearch();
    }
  }

  async function checkUpdates() {
    latestUpdateInfo.value = await checkForUpdate(version.value);
  }

  async function openExternal(url: string) {
    if (!isAllowedExternalUrl(url)) return;
    await api.openExternal(url);
  }

  async function onShow() {
    windowHidden.value = false;
    await loadSettings();
    await loadApps();
    searchQuery.value = '';
    selectedIndex.value = 0;
    searchVisible.value = false;
    if (settings.value?.autoCheckUpdate) {
      void checkUpdates();
    }
  }

  function onHide() {
    windowHidden.value = true;
  }

  return {
    apps,
    settings,
    draft,
    searchQuery,
    selectedIndex,
    viewSize,
    searchVisible,
    isSettingsOpen,
    windowHidden,
    version,
    latestUpdateInfo,
    shortcutError,
    recordingShortcut,
    shortcutDraft,
    ringColorsList,
    visibleApps,
    visibleAppCount,
    currentPage,
    pageCount,
    pageApps,
    goToPage,
    nextPage,
    prevPage,
    init,
    loadSettings,
    loadApps,
    refreshApps,
    syncViewSize,
    saveSettings,
    setSearch,
    toggleSearch,
    moveSelection,
    launchSelected,
    launchApp,
    toggleFavorite,
    toggleHide,
    unhideApp,
    unhideAll,
    openSettings,
    closeSettings,
    commitAndClose,
    addRingColor,
    removeRingColor,
    moveRingColor,
    addScanPath,
    removeScanPath,
    pickCenterIcon,
    resetCenterIcon,
    recordShortcut,
    handleKeydown,
    checkUpdates,
    openExternal,
    onShow,
    onHide,
  };
});
