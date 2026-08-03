<script setup lang="ts">
defineProps<{ hasApps: boolean }>();
const emit = defineEmits<{ 'open-settings': [] }>();
</script>

<template>
  <div id="empty-state">
    <p id="empty-message">{{ hasApps ? '没有匹配的应用' : '暂无应用' }}</p>
    <button id="open-settings" type="button" @click="emit('open-settings')">打开设置</button>
  </div>
</template>
