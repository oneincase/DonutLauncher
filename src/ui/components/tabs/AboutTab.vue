<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsView } from '../../types';
import { useLauncherStore } from '../../stores/launcher';

const store = useLauncherStore();
const draft = computed(() => store.draft as SettingsView);
const updateStatusText = computed(() => {
  const info = store.latestUpdateInfo;
  if (!info || info.error) return info?.error ? `检查失败：${info.error}` : '检查更新失败';
  if (info.notice) return info.notice;
  if (info.hasUpdate)
    return `发现新版本 ${info.latestVersion}，当前版本 ${info.currentVersion}`;
  return `当前已是最新版本 ${info.currentVersion}`;
});
</script>

<template>
  <div class="settings-pane" data-pane="about">
    <section class="settings-group">
      <div class="settings-group-label">软件信息</div>
      <div class="settings-group-content">
        <div class="settings-item stacked">
          <div class="settings-app-name">
            甜甜圈启动台 <span id="about-version">v{{ store.version }}</span>
          </div>
          <div class="settings-item-subtitle">
            macOS 圆形应用启动器，基于 Tauri + Vue 构建。
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">更新</div>
      <div class="settings-group-content">
        <label class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">自动检查更新</div>
          </div>
          <div class="settings-item-control">
            <input
              id="auto-update-input"
              type="checkbox"
              class="settings-toggle"
              v-model="draft.autoCheckUpdate"
            />
          </div>
        </label>
        <div class="settings-item stacked">
          <div class="settings-item-control">
            <button
              id="check-update-btn"
              type="button"
              class="settings-btn"
              @click="store.checkUpdates"
            >
              检查更新
            </button>
            <button
              id="update-download-btn"
              type="button"
              class="settings-btn update"
              :class="{ hidden: !store.latestUpdateInfo?.hasUpdate }"
              @click="store.openExternal(store.latestUpdateInfo?.releaseUrl || '')"
            >
              前往下载
            </button>
          </div>
          <div id="update-status" class="settings-status">{{ updateStatusText }}</div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">支持</div>
      <div class="settings-group-content">
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">GitHub 项目地址</div>
          </div>
          <div class="settings-item-control">
            <button
              id="open-github-btn"
              type="button"
              class="settings-btn"
              @click="store.openExternal('https://github.com/oneincase/DonutLauncher')"
            >
              访问仓库
            </button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">B站 UP：在下练习两年的坤</div>
          </div>
          <div class="settings-item-control">
            <button
              id="open-bilibili-btn"
              type="button"
              class="settings-btn"
              @click="store.openExternal('https://space.bilibili.com/44240441')"
            >
              访问主页
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
