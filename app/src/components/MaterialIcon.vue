<script setup lang="ts">
// Single icon primitive. Uses the self-hosted Material Symbols (Outlined) font
// imported in main.ts. Icon names: https://fonts.google.com/icons
// Decorative by default (aria-hidden); pass `label` for a standalone meaning.
const props = withDefaults(defineProps<{
  name: string
  size?: number
  label?: string
  fill?: boolean
}>(), { size: 24, fill: false })

// Material Symbols is a variable font; toggle the FILL axis for solid glyphs.
const fontVariationSettings = props.fill ? "'FILL' 1, 'wght' 500" : undefined
</script>

<template>
  <span
    class="material-symbols-outlined select-none leading-none"
    :style="{ fontSize: size + 'px', fontVariationSettings }"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    :role="label ? 'img' : undefined"
  >{{ name }}</span>
</template>
