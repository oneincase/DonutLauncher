<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SettingsView } from '../../types';
import { useLauncherStore } from '../../stores/launcher';

const store = useLauncherStore();
const draft = computed(() => store.draft as SettingsView);
const fileInput = ref<HTMLInputElement | null>(null);

function onFileChange() {
  const file = fileInput.value?.files?.[0];
  if (file) void store.pickCenterIcon(file);
}
</script>

<template>
  <div class="settings-pane" data-pane="launch">
    <section class="settings-group">
      <div class="settings-group-label">快捷键</div>
      <div class="settings-group-content">
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">全局快捷键</div>
            <div class="settings-item-subtitle">点击录制后按下新的组合键</div>
          </div>
          <div class="settings-item-control">
            <input
              id="shortcut-input"
              type="text"
              class="settings-input shortcut-input"
              :value="store.shortcutDraft"
              readonly
            />
            <button
              id="record-btn"
              type="button"
              class="settings-btn"
              :class="{ primary: store.recordingShortcut }"
              @click="store.recordingShortcut = !store.recordingShortcut"
            >
              {{ store.recordingShortcut ? '取消' : '录制' }}
            </button>
          </div>
        </div>
        <div v-if="store.recordingShortcut" id="record-hint" class="settings-hint">
          请按下新的快捷键，Esc 取消
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">启动</div>
      <div class="settings-group-content">
        <label class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">开机自动启动</div>
            <div class="settings-item-subtitle">登录 macOS 时自动启动甜甜圈启动台</div>
          </div>
          <div class="settings-item-control">
            <input
              id="auto-launch-input"
              type="checkbox"
              class="settings-toggle"
              v-model="draft.autoLaunch"
            />
          </div>
        </label>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">圆心</div>
      <div class="settings-group-content">
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">圆心图片</div>
            <div class="settings-item-subtitle">替换默认甜甜圈图标</div>
          </div>
          <div class="settings-item-control">
            <input
              id="center-icon-file"
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFileChange"
            />
            <button id="pick-center-btn" type="button" class="settings-btn" @click="fileInput?.click()">
              选择图片
            </button>
            <button
              id="reset-center-btn"
              type="button"
              class="settings-btn"
              @click="store.resetCenterIcon"
            >
              恢复默认
            </button>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">圆心图片大小</div>
          </div>
          <div class="settings-item-control">
            <span id="center-size-value" class="settings-value">{{ draft.centerIconSize }}</span>
            <input
              id="center-size-input"
              type="range"
              class="settings-slider"
              min="20"
              max="120"
              step="4"
              v-model.number="draft.centerIconSize"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
