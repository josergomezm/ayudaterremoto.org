<script setup lang="ts">
// Reusable spinner. Pass an optional localized label.
withDefaults(defineProps<{ label?: string; size?: number }>(), { size: 20 })
</script>

<template>
  <div class="flex items-center justify-center gap-2 text-slate-500" role="status" aria-live="polite">
    <span
      class="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
      :style="{ width: size + 'px', height: size + 'px' }"
    />
    <span v-if="label" class="text-sm">{{ label }}</span>
  </div>
</template>
