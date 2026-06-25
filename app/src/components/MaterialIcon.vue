<script setup lang="ts">
// Single icon primitive. Uses the self-hosted Material Symbols (Outlined) font
// imported in main.ts. Icon names: https://fonts.google.com/icons
// Decorative by default (aria-hidden); pass `label` for a standalone meaning.
const props = withDefaults(defineProps<{
  name: string
  size?: number
  label?: string
}>(), { size: 24 })
void props
</script>

<template>
  <span
    class="material-symbols-outlined select-none leading-none"
    :style="{ fontSize: size + 'px' }"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    :role="label ? 'img' : undefined"
  >{{ name }}</span>
</template>
