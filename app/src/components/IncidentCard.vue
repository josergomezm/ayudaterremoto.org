<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import TriageBadge from './TriageBadge.vue'
import MaterialIcon from './MaterialIcon.vue'
import type { Incident } from '../stores/incidents'
import { formatRelativeTime } from '../lib/date'

const props = defineProps<{ incident: Incident }>()
const { t, locale } = useI18n()

const isStale = computed(() => {
  if (props.incident.resolved || props.incident.evacuated) return false
  const date = new Date(props.incident.createdAt)
  if (isNaN(date.getTime())) return false
  const diffMs = Date.now() - date.getTime()
  return diffMs >= 72 * 60 * 60 * 1000
})
</script>

<template>
  <RouterLink
    :to="`/incidents/${incident.id}`"
    class="block space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <TriageBadge :status="incident.status" :evacuated="incident.evacuated" />
        <span v-if="incident.isProxy" class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">
          {{ t('triage.proxy') }}
        </span>
        <span v-if="isStale" class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800 border border-amber-200 animate-pulse">
          ⚠️ >72h
        </span>
        <span v-if="incident.aiFlagged" class="inline-flex items-center gap-0.5 rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-800">
          <MaterialIcon name="auto_awesome" :size="12" /> {{ t('triage.aiFlagged') }}
        </span>
        <span v-if="(incident.count ?? 1) > 1" class="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          <MaterialIcon name="hub" :size="12" /> {{ t('triage.nearby', { count: incident.count }) }}
        </span>
      </div>
      <span class="text-[11px] text-slate-400 font-medium shrink-0">
        {{ formatRelativeTime(incident.createdAt, locale) }}
      </span>
    </div>
    <!-- HERO SOURCE: title morphs to the detail page header (unique per page → id) -->
    <h3 class="font-semibold text-slate-900" :style="{ viewTransitionName: 'incident-title-' + incident.id }">
      {{ t('category.' + incident.category) }}
    </h3>
    
    <!-- Category-Specific Tags -->
    <div v-if="incident.structuralDamage || incident.resourceType || incident.medicalCount || incident.obstructionType" class="flex flex-wrap gap-1 text-[11px] font-semibold">
      <span v-if="incident.structuralDamage" class="rounded-full bg-slate-50 text-slate-600 px-2 py-0.5 border border-slate-200">
        🏢 {{ t('category.damageValues.' + incident.structuralDamage) }}
      </span>
      <span v-if="incident.resourceType" class="rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 border border-blue-100">
        📦 {{ t('category.resourceValues.' + incident.resourceType) }}
      </span>
      <span v-if="incident.medicalCount" class="rounded-full bg-red-50 text-red-600 px-2 py-0.5 border border-red-100">
        🚑 {{ t('category.medicalCountValues.' + incident.medicalCount) }}
      </span>
      <span v-if="incident.obstructionType" class="rounded-full bg-amber-50 text-amber-600 px-2 py-0.5 border border-amber-100">
        ⚠️ {{ t('category.obstructionValues.' + incident.obstructionType) }}
      </span>
    </div>

    <!-- Assignment Status Badge -->
    <div v-if="incident.assignmentStatus && incident.assignmentStatus !== 'unassigned'" class="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-200 w-max max-w-full">
      <MaterialIcon 
        :name="incident.assignmentStatus === 'en_route' ? 'local_shipping' : incident.assignmentStatus === 'on_site' ? 'place' : 'person'" 
        :size="14" 
        class="text-indigo-600 shrink-0" 
      />
      <span class="truncate">
        {{ incident.assignmentStatus === 'en_route' ? `En Camino (ETA: ${incident.assignmentEta || '?'})` : incident.assignmentStatus === 'on_site' ? 'En el Sitio' : 'Asignado' }}
        <span v-if="incident.assignedBrigade" class="text-slate-500 font-medium ml-1">· {{ incident.assignedBrigade }}</span>
      </span>
    </div>

    <p class="line-clamp-2 text-sm text-slate-600">{{ incident.description }}</p>
  </RouterLink>
</template>
