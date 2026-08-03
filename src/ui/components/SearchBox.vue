<script setup lang="ts">
import { onMounted, ref } from 'vue';

defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  inputRef.value?.focus();
});

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    id="search-input"
    ref="inputRef"
    class="search-box"
    type="text"
    placeholder="搜索应用"
    :value="modelValue"
    @input="onInput"
  />
</template>
