<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { AppEntry, SettingsView } from '../types';
import { DEFAULT_COLORS } from '../lib/color-utils';
import { layoutApps } from '../lib/donut-layout';
import { useLauncherStore } from '../stores/launcher';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  apps: AppEntry[];
  settings: SettingsView;
  viewSize: number;
  selectedIndex: number;
}>();

const emit = defineEmits<{
  launch: [path: string];
  'toggle-favorite': [app: AppEntry];
  'toggle-hide': [app: AppEntry];
  'open-settings': [];
}>();

const store = useLauncherStore();
const { isSettingsOpen, windowHidden, pageCount, currentPage } = storeToRefs(store);

const donutSvgRef = ref<SVGSVGElement | null>(null);
const spinGroupRef = ref<SVGGElement | null>(null);
const iconsGroupRef = ref<SVGGElement | null>(null);
const rotationOffset = ref(0);
let rotationId: number | null = null;
let hoveredIcons = 0;
let iconBodies: SVGElement[] = [];
let wheelAccumulator = 0;
let wheelIdleTimer: number | null = null;

const layout = computed(() =>
  layoutApps(
    props.apps,
    props.settings.ringColors.length ? props.settings.ringColors : DEFAULT_COLORS,
    rotationOffset.value,
    props.viewSize,
  ),
);
const centerSize = computed(() => props.settings.centerIconSize ?? 56);
const centerSrc = computed(() => props.settings.centerIconPath || '/center.jpg');

function dotX(index: number): number {
  const count = pageCount.value;
  const gap = 14;
  const totalWidth = (count - 1) * gap;
  return (props.viewSize - totalWidth) / 2 + (index - 1) * gap;
}

function applyTransform() {
  const group = spinGroupRef.value;
  if (!group) return;
  const scale = layout.value.fitScale;
  const center = layout.value.center;
  group.setAttribute(
    'transform',
    `translate(${center}, ${center}) rotate(${rotationOffset.value}) scale(${scale}) translate(${-center}, ${-center})`,
  );
}

function updateIconTransforms() {
  const transform = `rotate(${-rotationOffset.value} 0 0)`;
  iconBodies.forEach((body) => body.setAttribute('transform', transform));
}

function startRotation() {
  if (rotationId) cancelAnimationFrame(rotationId);
  const speed = props.settings.rotationSpeed ?? 1;
  if (speed <= 0) return;
  let last = performance.now();
  let lastRender = performance.now();
  const frame = (now: number) => {
    const targetFps = props.settings.targetFps ?? 60;
    if (targetFps > 0 && now - lastRender < 1000 / targetFps) {
      rotationId = requestAnimationFrame(frame);
      return;
    }
    lastRender = now;
    const dt = Math.min(now - last, 50);
    last = now;
    rotationOffset.value = (rotationOffset.value + dt * 0.006 * speed) % 360;
    applyTransform();
    updateIconTransforms();
    rotationId = requestAnimationFrame(frame);
  };
  rotationId = requestAnimationFrame(frame);
}

function stopRotation() {
  if (rotationId) {
    cancelAnimationFrame(rotationId);
    rotationId = null;
  }
}

function syncRotation() {
  if (
    (props.settings.enableRotation ?? true) &&
    hoveredIcons === 0 &&
    !windowHidden.value &&
    !isSettingsOpen.value
  ) {
    startRotation();
  } else {
    stopRotation();
  }
}

function onIconsMouseover(event: MouseEvent) {
  const icon = (event.target as Element).closest('.app-icon') as HTMLElement | null;
  if (!icon || icon.dataset.hovered) return;
  icon.dataset.hovered = '1';
  hoveredIcons += 1;
  if (hoveredIcons === 1) stopRotation();
}

function onIconsMouseout(event: MouseEvent) {
  const icon = (event.target as Element).closest('.app-icon') as HTMLElement | null;
  if (!icon || !icon.dataset.hovered) return;
  if (event.relatedTarget && icon.contains(event.relatedTarget as Node)) return;
  delete icon.dataset.hovered;
  hoveredIcons -= 1;
  if (hoveredIcons === 0) syncRotation();
}

const PAGE_SWIPE_THRESHOLD = 40;

function onWheel(event: WheelEvent) {
  if (isSettingsOpen.value) return;
  const deltaX = event.deltaX;
  if (deltaX === 0) return;
  event.preventDefault();
  wheelAccumulator += deltaX;
  if (wheelIdleTimer) {
    window.clearTimeout(wheelIdleTimer);
    wheelIdleTimer = null;
  }
  if (Math.abs(wheelAccumulator) >= PAGE_SWIPE_THRESHOLD) {
    if (wheelAccumulator < 0) store.nextPage();
    else store.prevPage();
    wheelAccumulator = 0;
  } else {
    wheelIdleTimer = window.setTimeout(() => {
      wheelAccumulator = 0;
      wheelIdleTimer = null;
    }, 120);
  }
}

async function afterRender() {
  await nextTick();
  iconBodies = Array.from(iconsGroupRef.value?.querySelectorAll('.app-icon-body') ?? []);
  hoveredIcons = 0;
  applyTransform();
  updateIconTransforms();
  syncRotation();
}

onMounted(() => {
  donutSvgRef.value?.addEventListener('wheel', onWheel, { passive: false });
  void afterRender();
});

watch(
  () => [props.apps, props.settings, props.viewSize, windowHidden.value, isSettingsOpen.value],
  afterRender,
);

onBeforeUnmount(() => {
  stopRotation();
  donutSvgRef.value?.removeEventListener('wheel', onWheel);
  if (wheelIdleTimer) {
    window.clearTimeout(wheelIdleTimer);
    wheelIdleTimer = null;
  }
});
</script>

<template>
  <svg
    id="donut"
    ref="donutSvgRef"
    :viewBox="`0 0 ${viewSize} ${viewSize}`"
    xmlns="http://www.w3.org/2000/svg"
    :style="{ '--icon-scale': String(settings.iconScale ?? 1.25) }"
  >
    <g id="spin-group" ref="spinGroupRef">
      <g id="rings">
        <circle
          v-for="(ring, index) in layout.rings"
          :key="`ring-${index}`"
          :cx="layout.center"
          :cy="layout.center"
          :r="ring.radius"
          :stroke="ring.color"
          :stroke-width="settings.ringStrokeWidth"
          :stroke-opacity="settings.ringOpacity"
          fill="none"
          class="ring"
        />
      </g>
      <g id="icons" ref="iconsGroupRef" @mouseover="onIconsMouseover" @mouseout="onIconsMouseout">
        <AppIcon
          v-for="(icon, index) in layout.icons"
          :key="icon.app.id"
          :icon="icon"
          :selected="index === selectedIndex"
          :icon-size="layout.iconSize"
          :label-font-size="layout.labelFontSize"
          :favorite="settings.favorites.includes(icon.app.id)"
          @launch="emit('launch', $event)"
          @toggle-favorite="emit('toggle-favorite', $event)"
          @toggle-hide="emit('toggle-hide', $event)"
        />
      </g>
    </g>
    <g id="center">
      <g
        id="center-icon"
        :transform="`translate(${layout.center}, ${layout.center})`"
        @click="emit('open-settings')"
      >
        <defs>
          <clipPath id="center-clip">
            <circle :r="centerSize / 2" />
          </clipPath>
        </defs>
        <template v-if="centerSrc">
          <image
            :x="-centerSize / 2"
            :y="-centerSize / 2"
            :width="centerSize"
            :height="centerSize"
            :href="centerSrc"
            preserveAspectRatio="xMidYMid slice"
            clip-path="url(#center-clip)"
          />
        </template>
        <template v-else>
          <circle r="44" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.3)" stroke-width="2" />
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="36" class="center-emoji">
            🍩
          </text>
        </template>
        <circle
          :r="centerSize / 2"
          fill="none"
          stroke="rgba(255, 255, 255, 0.35)"
          stroke-width="2"
        />
      </g>
    </g>
    <g v-if="pageCount > 1" id="page-dots" class="page-dots">
      <circle
        v-for="index in pageCount"
        :key="index"
        class="page-dot"
        :class="{ active: index - 1 === currentPage }"
        :cx="dotX(index)"
        :cy="viewSize - 28"
        r="4"
      />
    </g>
  </svg>
</template>
