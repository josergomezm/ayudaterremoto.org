<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MaterialIcon from './MaterialIcon.vue'
import type { TriageStatus } from '../stores/incidents'

const props = defineProps<{ status: TriageStatus; evacuated?: boolean }>()
const { t } = useI18n()

// Never rely on color alone — every status carries an icon + text label
// (accessibility + sunlight readability). See the crisis spec UI/UX section.
const map: Record<TriageStatus, { cls: string; icon: string }> = {
  green: { cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300', icon: 'check_circle' },
  yellow: { cls: 'bg-amber-100 text-amber-800 ring-amber-300', icon: 'warning' },
  red: { cls: 'bg-red-100 text-red-800 ring-red-300', icon: 'dangerous' },
}
const style = computed(() => map[props.status])
</script>

<template>
  <span
    v-if="evacuated"
    class="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-slate-600"
  >
    <MaterialIcon name="block" :size="14" /> {{ t('triage.evacuated') }}
  </span>
  <span
    v-else
    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1"
    :class="style.cls"
  >
    <MaterialIcon :name="style.icon" :size="14" /> {{ t('triage.' + status) }}
  </span>
</template>
