<script setup lang="ts">
import { computed } from 'vue';
import type { AppEntry, LayoutIcon } from '../types';

const props = defineProps<{
  icon: LayoutIcon;
  selected: boolean;
  iconSize: number;
  labelFontSize: number;
  favorite: boolean;
}>();

const emit = defineEmits<{
  launch: [path: string];
  'toggle-favorite': [app: AppEntry];
  'toggle-hide': [app: AppEntry];
}>();

const half = computed(() => props.iconSize / 2);
const initial = computed(() =>
  (props.icon.app.displayName || props.icon.app.name || '?').charAt(0).toUpperCase(),
);
const starFontSize = computed(() => Math.max(12 * (props.iconSize / 48), 10));
const hideFontSize = computed(() => Math.max(14 * (props.iconSize / 48), 12));
</script>

<template>
  <g
    class="app-icon"
    :class="{ selected }"
    :transform="`translate(${icon.x}, ${icon.y})`"
    @click="emit('launch', icon.app.path)"
  >
    <g class="app-icon-body">
      <image
        v-if="icon.app.iconDataUrl"
        :x="-half"
        :y="-half"
        :width="iconSize"
        :height="iconSize"
        :href="icon.app.iconDataUrl"
        preserveAspectRatio="xMidYMid slice"
      />
      <template v-else>
        <circle
          :r="half"
          fill="rgba(255, 255, 255, 0.18)"
          stroke="rgba(255, 255, 255, 0.45)"
          stroke-width="1.5"
        />
        <text
          x="0"
          y="1"
          text-anchor="middle"
          dominant-baseline="middle"
          class="app-fallback-label"
          :style="{ fontSize: `${Math.max(labelFontSize + 2, 9)}px` }"
        >
          {{ initial }}
        </text>
      </template>
      <text
        class="app-label"
        :y="half + 12"
        :style="{ fontSize: `${labelFontSize}px` }"
      >
        {{ icon.app.displayName || icon.app.name }}
      </text>
      <text
        class="app-star"
        :class="{ active: favorite }"
        :x="half - 1"
        :y="-half + 1"
        text-anchor="middle"
        dominant-baseline="middle"
        :style="{ fontSize: `${starFontSize}px` }"
        @click.stop="emit('toggle-favorite', icon.app)"
      >
        ★
      </text>
      <text
        class="app-hide"
        :x="-half + 1"
        :y="-half + 1"
        text-anchor="middle"
        dominant-baseline="middle"
        :style="{ fontSize: `${hideFontSize}px` }"
        @click.stop="emit('toggle-hide', icon.app)"
      >
        ×
      </text>
    </g>
  </g>
</template>
