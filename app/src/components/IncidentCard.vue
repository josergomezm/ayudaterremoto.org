<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import TriageBadge from './TriageBadge.vue'
import MaterialIcon from './MaterialIcon.vue'
import type { Incident } from '../stores/incidents'

defineProps<{ incident: Incident }>()
const { t } = useI18n()
</script>

<template>
  <RouterLink
    :to="`/incidents/${incident.id}`"
    class="block space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
  >
    <div class="flex flex-wrap items-center gap-2">
      <TriageBadge :status="incident.status" :evacuated="incident.evacuated" />
      <span v-if="incident.isProxy" class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">
        {{ t('triage.proxy') }}
      </span>
      <span v-if="incident.aiFlagged" class="inline-flex items-center gap-0.5 rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-800">
        <MaterialIcon name="auto_awesome" :size="12" /> {{ t('triage.aiFlagged') }}
      </span>
      <span v-if="(incident.count ?? 1) > 1" class="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        <MaterialIcon name="hub" :size="12" /> {{ t('triage.nearby', { count: incident.count }) }}
      </span>
    </div>
    <!-- HERO SOURCE: title morphs to the detail page header (unique per page → id) -->
    <h3 class="font-semibold text-slate-900" :style="{ viewTransitionName: 'incident-title-' + incident.id }">
      {{ t('category.' + incident.category) }}
    </h3>
    <p class="line-clamp-2 text-sm text-slate-600">{{ incident.description }}</p>
  </RouterLink>
</template>
