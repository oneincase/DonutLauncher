<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLauncherStore } from '../stores/launcher';
import SettingsIcon from './SettingsIcon.vue';
import LaunchTab from './tabs/LaunchTab.vue';
import AppearanceTab from './tabs/AppearanceTab.vue';
import AppsTab from './tabs/AppsTab.vue';
import AboutTab from './tabs/AboutTab.vue';

const store = useLauncherStore();
const activeTab = ref('launch');
const tabs = [
  { id: 'launch', label: '启动', icon: 'launch' as const },
  { id: 'appearance', label: '外观', icon: 'appearance' as const },
  { id: 'apps', label: '应用', icon: 'apps' as const },
  { id: 'about', label: '关于', icon: 'about' as const },
] as const;
const title = computed(() => tabs.find((t) => t.id === activeTab.value)?.label ?? '');
</script>

<template>
  <div id="settings-panel">
    <aside class="settings-sidebar">
      <div class="settings-sidebar-title">设置</div>
      <nav id="settings-tabs" class="settings-sidebar-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :class="['settings-sidebar-tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <SettingsIcon :name="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </aside>
    <main class="settings-main">
      <header class="settings-header">
        <h2>{{ title }}</h2>
        <button id="close-btn" type="button" class="settings-close" @click="store.closeSettings">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </header>
      <div v-if="store.shortcutError" id="shortcut-error" class="settings-error">
        {{ store.shortcutError }}
      </div>
      <div class="settings-body">
        <LaunchTab v-if="activeTab === 'launch'" />
        <AppearanceTab v-else-if="activeTab === 'appearance'" />
        <AppsTab v-else-if="activeTab === 'apps'" />
        <AboutTab v-else />
      </div>
      <footer class="settings-footer">
        <button id="refresh-btn" type="button" class="settings-btn" @click="store.refreshApps">
          刷新应用
        </button>
        <button id="save-btn" type="button" class="settings-btn primary" @click="store.commitAndClose">
          保存
        </button>
      </footer>
    </main>
  </div>
</template>
