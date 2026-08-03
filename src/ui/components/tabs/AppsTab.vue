<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsView } from '../../types';
import { useLauncherStore } from '../../stores/launcher';

const store = useLauncherStore();
const draft = computed(() => store.draft as SettingsView);
const customPaths = computed(() => {
  const defaults = draft.value.defaultScanPaths || [];
  return draft.value.scanPaths.filter((path) => !defaults.includes(path));
});

function unhideDraft(name: string) {
  draft.value.excludedApps = draft.value.excludedApps.filter((item) => item !== name);
}

function unhideAllDraft() {
  draft.value.excludedApps = [];
}
</script>

<template>
  <div class="settings-pane" data-pane="apps">
    <section class="settings-group">
      <div class="settings-group-label">扫描路径</div>
      <div class="settings-group-content">
        <div class="settings-item stacked">
          <div class="settings-item-text">
            <div class="settings-item-title">默认扫描路径</div>
          </div>
          <div id="default-paths-list" class="settings-list">
            <div
              v-for="path in draft.defaultScanPaths"
              :key="path"
              class="settings-list-row"
            >
              <span>{{ path }}</span>
            </div>
          </div>
        </div>
        <div class="settings-item stacked">
          <div class="settings-item-header">
            <div class="settings-item-text">
              <div class="settings-item-title">自定义扫描路径</div>
            </div>
            <button
              id="add-path-btn"
              type="button"
              class="settings-btn small"
              @click="store.addScanPath"
            >
              添加路径
            </button>
          </div>
          <div id="custom-paths-list" class="settings-list">
            <p v-if="customPaths.length === 0" class="settings-empty">暂无自定义路径</p>
            <div v-for="path in customPaths" :key="path" class="settings-list-row">
              <span>{{ path }}</span>
              <button
                type="button"
                class="settings-btn small"
                @click="store.removeScanPath(path)"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">已隐藏应用</div>
      <div class="settings-group-content">
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">隐藏的应用</div>
          </div>
          <div class="settings-item-control">
            <button
              id="unhide-all-btn"
              type="button"
              class="settings-btn small"
              @click="unhideAllDraft"
            >
              全部取消隐藏
            </button>
          </div>
        </div>
        <div id="hidden-apps-list" class="settings-list">
          <p v-if="draft.excludedApps.length === 0" class="settings-empty">无</p>
          <div v-for="name in draft.excludedApps" :key="name" class="settings-list-row">
            <span>{{ name }}</span>
            <button type="button" class="settings-btn small" @click="unhideDraft(name)">
              取消隐藏
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
