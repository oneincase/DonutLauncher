<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import DonutStage from './components/DonutStage.vue';
import EmptyState from './components/EmptyState.vue';
import SearchBox from './components/SearchBox.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import { api } from './services/api';
import { useLauncherStore } from './stores/launcher';

const store = useLauncherStore();
const { isSettingsOpen, searchQuery, searchVisible, selectedIndex, settings, viewSize, visibleApps, pageApps } =
  storeToRefs(store);

let unlisteners: Array<() => void> = [];

function onKeydown(event: KeyboardEvent) {
  store.handleKeydown(event);
}

function onContextMenu(event: MouseEvent) {
  // WKWebView on macOS shows a native context menu (including "Reload") on
  // right click; suppress it since this app has no use for it.
  event.preventDefault();
}

onMounted(async () => {
  unlisteners.push(api.onEvent('show', () => void store.onShow()));
  unlisteners.push(api.onEvent('hide', () => store.onHide()));
  unlisteners.push(api.onEvent('open-settings', () => store.openSettings()));
  unlisteners.push(
    api.onEvent('shortcut-error', () => {
      store.shortcutError = '快捷键注册失败，可能被系统或其他应用占用';
    }),
  );
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  await store.init();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('contextmenu', onContextMenu, { capture: true });
  unlisteners.forEach((unlisten) => unlisten());
  unlisteners = [];
});
</script>

<template>
  <div id="app">
    <DonutStage
      v-if="pageApps.length > 0 && settings"
      :apps="pageApps"
      :settings="settings"
      :view-size="viewSize"
      :selected-index="selectedIndex"
      @launch="store.launchApp"
      @toggle-favorite="store.toggleFavorite"
      @toggle-hide="store.toggleHide"
      @open-settings="store.openSettings"
    />
    <EmptyState
      v-else-if="settings"
      :has-apps="store.apps.length > 0"
      @open-settings="store.openSettings"
    />
    <SearchBox
      v-if="searchVisible"
      :model-value="searchQuery"
      @update:model-value="store.setSearch"
    />
    <SettingsPanel v-if="isSettingsOpen" />
  </div>
</template>
