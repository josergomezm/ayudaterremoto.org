<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useIncidentsStore, type TriageStatus } from '../stores/incidents'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import TriageBadge from '../components/TriageBadge.vue'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import IncidentMap from '../components/IncidentMap.vue'
import { formatRelativeTime, formatAbsoluteTime } from '../lib/date'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useIncidentsStore()
const session = useSessionStore()
const admin = useAdminStore()

// Responders (field) AND coordinators/command (admin) can manage incidents.
const canManage = computed(() => session.can('coordinador') || admin.isAdmin)

const id = computed(() => String(route.params.id))
const incident = computed(() => store.byId(id.value))

onMounted(() => { if (store.incidents.length === 0) store.fetchAll() })

const statuses: TriageStatus[] = ['green', 'yellow', 'red']


</script>

<template>
  <div v-if="incident" class="mx-auto">
    <div class="space-y-4 p-4">
      <button class="flex items-center gap-1 text-sm font-semibold text-slate-500" @click="router.back()">
        <MaterialIcon name="arrow_back" :size="18" /> {{ t('common.back') }}
      </button>

      <!-- Real map of the incident location (replaces the old color block) -->
      <IncidentMap :incidents="[incident]" />
      <div class="flex flex-wrap items-center gap-2">
        <TriageBadge :status="incident.status" :evacuated="incident.evacuated" />
        <span v-if="incident.isProxy" class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">
          {{ t('triage.proxy') }}
        </span>
      </div>

      <h1
        class="text-2xl font-bold text-slate-900"
        :style="{ viewTransitionName: 'incident-title-' + incident.id }"
      >
        {{ t('category.' + incident.category) }}
      </h1>
      
      <div class="text-xs text-slate-500 font-medium -mt-1 flex items-center gap-1">
        <span>{{ t('detail.reportedBy') }}:</span>
        <span class="text-slate-700 font-semibold">{{ formatRelativeTime(incident.createdAt, locale) }}</span>
        <span class="text-slate-300">•</span>
        <span>{{ formatAbsoluteTime(incident.createdAt, locale) }}</span>
      </div>

      <!-- Category Specific Attributes Display -->
      <div v-if="incident.structuralDamage || incident.resourceType || incident.medicalCount || incident.obstructionType" class="flex flex-wrap gap-2 text-xs font-semibold my-1">
        <span v-if="incident.structuralDamage" class="rounded-full bg-slate-100 text-slate-700 px-3 py-1 ring-1 ring-slate-200">
          🏢 {{ t('category.structuralDamageLabel') }}: {{ t('category.damageValues.' + incident.structuralDamage) }}
        </span>
        <span v-if="incident.resourceType" class="rounded-full bg-blue-50 text-blue-700 px-3 py-1 ring-1 ring-blue-100">
          📦 {{ t('category.resourceTypeLabel') }}: {{ t('category.resourceValues.' + incident.resourceType) }}
        </span>
        <span v-if="incident.medicalCount" class="rounded-full bg-red-50 text-red-700 px-3 py-1 ring-1 ring-red-100">
          🚑 {{ t('category.medicalCountLabel') }}: {{ t('category.medicalCountValues.' + incident.medicalCount) }}
        </span>
        <span v-if="incident.obstructionType" class="rounded-full bg-amber-50 text-amber-700 px-3 py-1 ring-1 ring-amber-100">
          ⚠️ {{ t('category.obstructionTypeLabel') }}: {{ t('category.obstructionValues.' + incident.obstructionType) }}
        </span>
      </div>

      <p v-if="incident.subjectName" class="text-sm font-medium text-slate-700">{{ incident.subjectName }}</p>
      <p class="text-slate-700">{{ incident.description }}</p>
      <p class="text-sm text-slate-500">{{ t('triage.level') }}: {{ incident.triageLevel }}</p>

      <!-- Gemini "hidden net" escalation note -->
      <div v-if="incident.aiFlagged" class="flex gap-2 rounded-xl bg-fuchsia-50 p-3 text-sm text-fuchsia-900 ring-1 ring-fuchsia-200">
        <MaterialIcon name="auto_awesome" :size="18" class="shrink-0" />
        <span><strong>{{ t('detail.aiNote') }}</strong> {{ incident.aiReason }}</span>
      </div>

      <!-- Master Incident: every report grouped here ("what each person said") -->
      <div v-if="incident.reports && incident.reports.length > 1" class="space-y-2 rounded-2xl bg-slate-50 p-3">
        <h2 class="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <MaterialIcon name="hub" :size="16" /> {{ t('detail.reportsHeading') }} ({{ incident.count }})
        </h2>
        <ul class="space-y-2">
          <li v-for="r in incident.reports" :key="r.id" class="rounded-xl bg-white p-2.5 text-sm ring-1 ring-slate-200">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
              <span class="font-medium text-slate-500">{{ formatRelativeTime(r.createdAt, locale) }}</span>
              <span class="text-slate-300">•</span>
              <span>{{ formatAbsoluteTime(r.createdAt, locale) }}</span>
              <span v-if="r.isProxy" class="rounded-full bg-violet-100 px-1.5 font-semibold text-violet-700">{{ t('triage.proxy') }}</span>
              <span v-if="r.aiFlagged" class="rounded-full bg-fuchsia-100 px-1.5 font-semibold text-fuchsia-700">{{ t('triage.aiFlagged') }}</span>
            </div>
            <p class="text-slate-800">{{ r.description }}</p>
            <p v-if="r.unit" class="text-xs text-slate-500">{{ t('detail.unitLabel') }}: {{ r.unit }}</p>
            <p v-if="r.reporter" class="text-xs text-slate-500">{{ t('detail.reporterLabel') }}: {{ r.reporter }}</p>
          </li>
        </ul>
      </div>

      <div v-if="incident.evacuated" class="flex items-center gap-2 rounded-xl bg-slate-800 p-3 text-sm font-semibold text-white">
        <MaterialIcon name="block" :size="20" /> {{ t('detail.evacuatedBadge') }}
      </div>

      <!-- Responder+ controls -->
      <div v-if="canManage && (!incident.evacuated || admin.isAdmin)" class="space-y-3 border-t border-slate-200 pt-4">
        <div>
          <div class="mb-1 text-sm font-semibold text-slate-700">
            {{ t('detail.updateStatus') }}
            <span v-if="incident.evacuated" class="text-xs font-bold text-slate-400 uppercase ml-2">({{ t('triage.evacuated') }})</span>
          </div>
          <div class="flex gap-2">
            <BaseButton
              v-for="s in statuses"
              :key="s"
              :variant="incident.status === s ? 'primary' : 'neutral'"
              @click="store.setStatus(incident.id, s)"
            >
              {{ t('triage.' + s) }}
            </BaseButton>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseButton v-if="!incident.evacuated" variant="neutral" @click="store.evacuate(incident.id)">{{ t('detail.markEvacuated') }}</BaseButton>
          <BaseButton v-if="!incident.resolved" variant="neutral" @click="store.resolve(incident.id)">
            {{ t('detail.markResolved') }}
          </BaseButton>
        </div>
      </div>

      <!-- Resolution verification: the reporter confirms the fix -->
      <div v-if="incident.resolved && incident.resolutionConfirmed === null" class="space-y-2 rounded-xl bg-amber-50 p-3">
        <p class="text-sm font-medium text-amber-900">{{ t('detail.resolutionPrompt') }}</p>
        <div class="flex gap-2">
          <BaseButton variant="primary" @click="store.confirmResolution(incident.id, true)">{{ t('common.yes') }}</BaseButton>
          <BaseButton variant="danger" @click="store.confirmResolution(incident.id, false)">{{ t('common.no') }}</BaseButton>
        </div>
      </div>
      <p v-else-if="incident.resolutionConfirmed === true" class="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <MaterialIcon name="check_circle" :size="18" /> {{ t('detail.resolvedConfirmed') }}
      </p>
      <p v-else-if="incident.resolutionConfirmed === false" class="flex items-center gap-1.5 text-sm font-semibold text-red-700">
        <MaterialIcon name="cancel" :size="18" /> {{ t('detail.resolvedRejected') }}
      </p>
      <p v-else-if="incident.resolved" class="text-sm text-slate-500">{{ t('detail.resolvedPending') }}</p>
    </div>
  </div>

  <div v-else class="p-8 text-center text-slate-500">
    {{ t('detail.notFound') }}
  </div>
</template>
