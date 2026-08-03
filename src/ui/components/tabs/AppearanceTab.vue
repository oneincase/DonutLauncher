<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { SettingsView } from '../../types';
import {
  COLOR_PRESETS,
  DEFAULT_COLORS,
  hexToHsl,
  hslToHex,
  normalizeHex,
} from '../../lib/color-utils';
import { useLauncherStore } from '../../stores/launcher';

const store = useLauncherStore();
const draft = computed(() => store.draft as SettingsView);
const hue = ref(344);
const saturation = ref(100);
const lightness = ref(72);
const hexInput = ref('#FF6B9D');
const draggingIndex = ref(-1);

const fpsOptions = [
  { value: 30, label: '30 FPS' },
  { value: 60, label: '60 FPS' },
  { value: 120, label: '120 FPS' },
  { value: 0, label: '无限制' },
];

function previewHex() {
  const hex = hslToHex(hue.value, saturation.value, lightness.value);
  hexInput.value = hex;
  return hex;
}

function syncFromHex(hex: string) {
  const normalized = normalizeHex(hex) || DEFAULT_COLORS[0];
  const { h, s, l } = hexToHsl(normalized);
  hue.value = h;
  saturation.value = s;
  lightness.value = l;
  hexInput.value = normalized;
}

function onHexChange() {
  const hex = normalizeHex(hexInput.value);
  if (hex) {
    syncFromHex(hex);
    store.addRingColor(hex);
  } else {
    hexInput.value = previewHex();
  }
}

function onDragStart(index: number, event: DragEvent) {
  draggingIndex.value = index;
  if (event.dataTransfer) event.dataTransfer.setData('text/plain', String(index));
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault();
  const from = Number(event.dataTransfer?.getData('text/plain') || draggingIndex.value);
  store.moveRingColor(from, index);
  draggingIndex.value = -1;
}

onMounted(() => {
  const last = draft.value.ringColors[draft.value.ringColors.length - 1] || DEFAULT_COLORS[0];
  syncFromHex(last);
});
</script>

<template>
  <div class="settings-pane" data-pane="appearance">
    <section class="settings-group">
      <div class="settings-group-label">外观</div>
      <div class="settings-group-content">
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">圆环透明度</div>
          </div>
          <div class="settings-item-control">
            <span id="opacity-value" class="settings-value">
              {{ Number(draft.ringOpacity).toFixed(2) }}
            </span>
            <input
              id="opacity-input"
              type="range"
              class="settings-slider"
              min="0"
              max="1"
              step="0.05"
              v-model.number="draft.ringOpacity"
            />
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">圆环粗细</div>
          </div>
          <div class="settings-item-control">
            <span id="stroke-value" class="settings-value">{{ draft.ringStrokeWidth }}</span>
            <input
              id="stroke-input"
              type="range"
              class="settings-slider"
              min="1"
              max="50"
              step="0.5"
              v-model.number="draft.ringStrokeWidth"
            />
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">选中放大</div>
          </div>
          <div class="settings-item-control">
            <span id="icon-scale-value" class="settings-value">
              {{ Number(draft.iconScale).toFixed(2) }}
            </span>
            <input
              id="icon-scale-input"
              type="range"
              class="settings-slider"
              min="1"
              max="2.5"
              step="0.05"
              v-model.number="draft.iconScale"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">动画</div>
      <div class="settings-group-content">
        <label class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">开启缓慢旋转</div>
          </div>
          <div class="settings-item-control">
            <input
              id="rotation-input"
              type="checkbox"
              class="settings-toggle"
              v-model="draft.enableRotation"
            />
          </div>
        </label>
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">旋转速度</div>
          </div>
          <div class="settings-item-control">
            <span id="rotation-speed-value" class="settings-value">{{ draft.rotationSpeed }}</span>
            <input
              id="rotation-speed-input"
              type="range"
              class="settings-slider"
              min="0"
              max="3"
              step="0.25"
              v-model.number="draft.rotationSpeed"
            />
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">帧率限制</div>
            <div class="settings-item-subtitle">降低帧率可减少 GPU 占用</div>
          </div>
          <div class="settings-item-control">
            <div id="fps-options" class="settings-segmented">
              <button
                v-for="option in fpsOptions"
                :key="option.value"
                type="button"
                :class="{ active: draft.targetFps === option.value }"
                @click="draft.targetFps = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">颜色</div>
      <div class="settings-group-content">
        <div class="settings-item stacked">
          <div class="settings-item-text">
            <div class="settings-item-title">圆环颜色</div>
          </div>
          <div class="settings-item-control color-block">
            <div id="color-presets" class="color-presets">
              <button
                v-for="color in COLOR_PRESETS"
                :key="color"
                type="button"
                class="color-swatch"
                :style="{ background: color }"
                :title="color"
                @click="store.addRingColor(color)"
              />
            </div>
            <div id="color-chips" class="color-chips">
              <div
                v-for="(color, index) in draft.ringColors"
                :key="`${color}-${index}`"
                class="color-chip"
                draggable="true"
                :style="{ background: color }"
                @dragstart="onDragStart(index, $event)"
                @dragend="draggingIndex = -1"
                @dragover.prevent
                @drop="onDrop(index, $event)"
              >
                <button
                  type="button"
                  class="color-chip-remove"
                  @click="store.removeRingColor(index)"
                >
                  ×
                </button>
              </div>
            </div>
            <div class="custom-color-row">
              <span
                id="color-preview"
                class="custom-color-preview"
                :style="{ background: hexInput }"
              />
              <input
                id="color-hue"
                type="range"
                min="0"
                max="360"
                step="1"
                v-model.number="hue"
                title="色相"
                @input="previewHex"
                @change="store.addRingColor(previewHex())"
              />
              <input
                id="color-hex"
                type="text"
                class="settings-input color-hex"
                maxlength="7"
                v-model="hexInput"
                spellcheck="false"
                @change="onHexChange"
              />
            </div>
            <div class="custom-color-sliders">
              <input
                id="color-saturation"
                type="range"
                min="0"
                max="100"
                step="1"
                v-model.number="saturation"
                title="饱和度"
                @input="previewHex"
                @change="store.addRingColor(previewHex())"
              />
              <input
                id="color-lightness"
                type="range"
                min="0"
                max="100"
                step="1"
                v-model.number="lightness"
                title="明度"
                @input="previewHex"
                @change="store.addRingColor(previewHex())"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">排序</div>
      <div class="settings-group-content">
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-title">排序方式</div>
          </div>
          <div class="settings-item-control">
            <select id="sort-input" class="settings-select" v-model="draft.sortMode">
              <option value="name">名称</option>
              <option value="recent">最近使用</option>
              <option value="favorites">收藏优先</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
