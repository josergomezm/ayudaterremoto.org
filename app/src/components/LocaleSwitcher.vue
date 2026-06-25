<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES, type Locale } from '../i18n'

const { locale } = useI18n()
function set(l: Locale) {
  // Flips the global locale AND persists the choice (see docs/i18n.md).
  setLocale(l)
}
</script>

<template>
  <div class="inline-flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm font-semibold">
    <button
      v-for="l in SUPPORTED_LOCALES"
      :key="l"
      class="rounded-md px-3 py-1.5 uppercase"
      :class="locale === l ? 'bg-slate-900 text-white' : 'text-slate-500'"
      @click="set(l)"
    >
      {{ l }}
    </button>
  </div>
</template>
