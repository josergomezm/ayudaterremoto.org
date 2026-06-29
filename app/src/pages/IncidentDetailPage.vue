<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useIncidentsStore, type TriageStatus } from '../stores/incidents'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useOnline } from '../composables/useOnline'
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
const { online } = useOnline()

// Responders (field) AND coordinators/command (admin) can manage incidents.
const canManage = computed(() => session.can('rescuer') || admin.isAdmin)

const id = computed(() => String(route.params.id))
const incident = computed(() => store.byId(id.value))

onMounted(() => { if (store.incidents.length === 0) store.fetchAll() })

const statuses: TriageStatus[] = ['green', 'yellow', 'red']

// 72h Control & Re-verification
const isStale = computed(() => {
  if (!incident.value) return false
  if (incident.value.resolved || incident.value.evacuated) return false
  const date = new Date(incident.value.createdAt)
  if (isNaN(date.getTime())) return false
  const diffMs = Date.now() - date.getTime()
  return diffMs >= 72 * 60 * 60 * 1000
})
const showReverifyForm = ref(false)
const reverifyNotes = ref('')
const reverifying = ref(false)

async function doReverify() {
  if (!reverifyNotes.value.trim() || !incident.value) return
  reverifying.value = true
  const res = await store.reverifyIncident(incident.value.id, { notes: reverifyNotes.value.trim() })
  reverifying.value = false
  if (res.ok) {
    reverifyNotes.value = ''
    showReverifyForm.value = false
  }
}

// Assignment Flow
const updatingAssignment = ref(false)
const assignEta = ref('')
const assignNotes = ref('')

async function doClaim() {
  if (!incident.value) return
  updatingAssignment.value = true
  await store.assignIncident(incident.value.id)
  updatingAssignment.value = false
}

async function doUpdateAssignment(status: string) {
  if (!incident.value) return
  updatingAssignment.value = true
  await store.updateAssignment(incident.value.id, {
    status,
    eta: status === 'en_route' ? assignEta.value.trim() : undefined,
    notes: assignNotes.value.trim() || undefined
  })
  updatingAssignment.value = false
  if (status === 'unassigned') {
    assignEta.value = ''
    assignNotes.value = ''
  }
}

// Outcome resolution
const showResolveForm = ref(false)
const outcomeSurvivors = ref(0)
const outcomeDeceased = ref(0)
const outcomeInjured = ref(0)
const outcomeStructuralDamage = ref('none')
const outcomeDetails = ref('')
const resolving = ref(false)

async function doResolveWithOutcome() {
  if (!incident.value) return
  resolving.value = true
  const res = await store.resolveIncidentWithOutcome(incident.value.id, {
    outcomeSurvivors: outcomeSurvivors.value,
    outcomeDeceased: outcomeDeceased.value,
    outcomeInjured: outcomeInjured.value,
    outcomeStructuralDamage: outcomeStructuralDamage.value,
    outcomeDetails: outcomeDetails.value.trim() || undefined
  })
  resolving.value = false
  if (res.ok) {
    showResolveForm.value = false
  }
}
</script>

<template>
  <div class="supply-theme detail-page">
    <div v-if="incident" class="wrap space-y-4">
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

      <!-- 72-Hour Control Warning Banner -->
      <div v-if="isStale" class="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 text-amber-900">
        <div class="flex gap-2 text-sm font-semibold">
          <MaterialIcon name="warning" :size="20" class="text-amber-600 shrink-0" />
          <span>{{ t('detail.staleReportWarning') }}</span>
        </div>
        <div v-if="incident.lastReverifiedAt" class="text-xs font-semibold text-amber-800">
          ✓ {{ t('detail.lastReverified') }}: {{ formatRelativeTime(incident.lastReverifiedAt, locale) }} 
          <span class="font-normal">({{ formatAbsoluteTime(incident.lastReverifiedAt, locale) }})</span>
          <span class="block mt-0.5 text-slate-600 italic">“{{ incident.reverificationNotes }}”</span>
        </div>
        <!-- Re-verify action for rescuers -->
        <div v-if="canManage" class="pt-1">
          <BaseButton v-if="!showReverifyForm" size="small" variant="neutral" @click="showReverifyForm = true">
            <span class="flex items-center gap-1"><MaterialIcon name="verified_user" :size="16" /> {{ t('detail.reverifyButton') }}</span>
          </BaseButton>
          <div v-else class="space-y-3 bg-white p-3 rounded-xl border border-slate-200 mt-2">
            <div class="space-y-1">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">{{ t('detail.reverificationNotesLabel') }}</label>
              <textarea 
                v-model="reverifyNotes"
                rows="2"
                :placeholder="t('detail.reverifyNotesPlaceholder')"
                class="w-full text-sm border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-slate-800 bg-white"
              />
            </div>
            <div class="flex gap-2 justify-end">
              <BaseButton size="small" variant="neutral" @click="showReverifyForm = false">Cancelar</BaseButton>
              <BaseButton size="small" :disabled="reverifying || !reverifyNotes.trim()" @click="doReverify">Guardar Check-in</BaseButton>
            </div>
          </div>
        </div>
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

      <!-- Detailed Outcome Report (Closure Card) -->
      <div v-if="incident.resolved" class="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 space-y-4">
        <h2 class="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
          <MaterialIcon name="emoji_events" :size="18" class="text-emerald-700" />
          {{ t('detail.outcomeTitle') }}
        </h2>
        
        <!-- Casualty/Rescues Summary Statistics (Gated for rescuers+ / privacy) -->
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-white p-2.5 rounded-xl border border-emerald-100">
            <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeSurvivorsLabel') }}</span>
            <span class="block text-lg font-extrabold text-emerald-700 mt-1">✨ {{ incident.outcomeSurvivors ?? 0 }}</span>
          </div>
          <div class="bg-white p-2.5 rounded-xl border border-emerald-100">
            <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeInjuredLabel') }}</span>
            <span class="block text-lg font-extrabold text-amber-700 mt-1">🚑 {{ incident.outcomeInjured ?? 0 }}</span>
          </div>
          <div v-if="session.can('rescuer')" class="bg-white p-2.5 rounded-xl border border-emerald-100">
            <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeDeceasedLabel') }}</span>
            <span class="block text-lg font-extrabold text-red-700 mt-1">💀 {{ incident.outcomeDeceased ?? 0 }}</span>
          </div>
          <div v-else class="bg-slate-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-center text-[10px] text-slate-400 font-semibold italic">
            [Privado]
          </div>
        </div>

        <div class="text-xs text-slate-700 space-y-2.5">
          <div v-if="incident.outcomeStructuralDamage" class="font-bold">
            🏢 {{ t('detail.outcomeDamageLabel') }}: 
            <span class="rounded bg-white px-2 py-0.5 border border-emerald-100 text-slate-800 ml-1">
              {{ t('category.damageValues.' + incident.outcomeStructuralDamage) }}
            </span>
          </div>
          <div v-if="incident.outcomeDetails" class="bg-white p-3 rounded-xl border border-emerald-100 text-slate-600 leading-relaxed italic">
            “{{ incident.outcomeDetails }}”
          </div>
          <div class="text-[10px] text-slate-400 font-medium pt-1.5 flex justify-between flex-wrap gap-1">
            <span>{{ t('detail.resolvedBy') }}: <b>{{ incident.outcomeSubmittedBy }}</b></span>
            <span>{{ formatAbsoluteTime(incident.outcomeSubmittedAt, locale) }}</span>
          </div>
        </div>
      </div>

      <!-- Assignment Panel (Visible to everyone) -->
      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 space-y-4">
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <MaterialIcon name="assignment_ind" :size="18" class="text-indigo-600" />
          {{ t('detail.assignmentSection') }}
        </h2>

        <!-- Current Assignment State -->
        <div v-if="incident.assignmentStatus && incident.assignmentStatus !== 'unassigned'" class="space-y-3">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <MaterialIcon 
                :name="incident.assignmentStatus === 'en_route' ? 'local_shipping' : incident.assignmentStatus === 'on_site' ? 'place' : 'person'" 
                :size="20" 
              />
            </div>
            <div>
              <div class="text-xs text-slate-500 font-medium">Asignado a:</div>
              <div class="text-sm font-bold text-slate-900">
                {{ incident.assignedName }}
                <span v-if="incident.assignedBrigade" class="text-slate-500 font-semibold text-xs ml-1">· {{ incident.assignedBrigade }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
            <div>
              <span class="block text-slate-400 font-medium">{{ t('detail.assignmentStatusLabel') }}</span>
              <span class="font-bold text-slate-700 uppercase">
                {{ incident.assignmentStatus === 'assigned' ? t('detail.statusAssigned') : incident.assignmentStatus === 'en_route' ? t('detail.statusEnRoute') : incident.assignmentStatus === 'on_site' ? t('detail.statusOnSite') : incident.assignmentStatus === 'handling' ? t('detail.statusHandling') : incident.assignmentStatus }}
              </span>
            </div>
            <div v-if="incident.assignmentEta">
              <span class="block text-slate-400 font-medium">{{ t('detail.assignmentEtaLabel') }}</span>
              <span class="font-bold text-slate-700">{{ incident.assignmentEta }}</span>
            </div>
          </div>

          <div v-if="incident.assignmentNotes" class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs italic text-slate-600 mt-2">
            “{{ incident.assignmentNotes }}”
          </div>
        </div>

        <div v-else class="text-xs text-slate-500 font-semibold italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
          {{ t('detail.statusUnassigned') }}
        </div>

        <!-- Offline notice for assignments -->
        <div v-if="!online && canManage" class="text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-1.5 mt-2">
          <MaterialIcon name="wifi_off" :size="16" />
          <span>{{ t('detail.offlineWarning') }}</span>
        </div>

        <!-- Responder Action Controls -->
        <div v-if="canManage && online && !incident.resolved && !incident.evacuated" class="border-t border-slate-100 pt-3">
          <!-- Case 1: Unassigned - Claim button -->
          <div v-if="!incident.assignmentStatus || incident.assignmentStatus === 'unassigned'">
            <BaseButton block size="small" :disabled="updatingAssignment" @click="doClaim">
              <span class="flex items-center justify-center gap-1"><MaterialIcon name="front_hand" :size="16" /> {{ t('detail.claimIncident') }}</span>
            </BaseButton>
          </div>

          <!-- Case 2: Assigned - Update Form for Assignee / Coordinator -->
          <div v-else-if="incident.assignedTo === session.email || session.can('coordinator')" class="space-y-3">
            <div class="text-xs font-bold text-slate-700">{{ t('detail.updateProgress') }}</div>
            
            <div class="flex flex-wrap gap-2">
              <BaseButton 
                v-if="incident.assignmentStatus === 'assigned'" 
                size="small" 
                variant="primary" 
                @click="doUpdateAssignment('en_route')"
              >
                {{ t('detail.statusEnRoute') }}
              </BaseButton>
              <BaseButton 
                v-if="incident.assignmentStatus === 'en_route'" 
                size="small" 
                variant="primary" 
                @click="doUpdateAssignment('on_site')"
              >
                {{ t('detail.statusOnSite') }}
              </BaseButton>
              <BaseButton 
                v-if="incident.assignmentStatus === 'on_site'" 
                size="small" 
                variant="primary" 
                @click="doUpdateAssignment('handling')"
              >
                {{ t('detail.statusHandling') }}
              </BaseButton>
              
              <BaseButton size="small" variant="neutral" @click="doUpdateAssignment('unassigned')">
                Liberar reporte
              </BaseButton>
            </div>

            <!-- ETA and Note inputs -->
            <div class="space-y-2 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div v-if="incident.assignmentStatus === 'assigned'" class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.assignmentEtaLabel') }}</label>
                <input 
                  v-model="assignEta" 
                  type="text" 
                  :placeholder="t('detail.etaPlaceholder')" 
                  class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent bg-white"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.assignmentNotesLabel') }}</label>
                <textarea 
                  v-model="assignNotes" 
                  rows="2"
                  :placeholder="t('detail.notesPlaceholder')" 
                  class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent bg-white"
                />
              </div>
              <BaseButton 
                size="small" 
                variant="neutral" 
                :disabled="updatingAssignment"
                @click="doUpdateAssignment(incident.assignmentStatus)"
              >
                Guardar Nota / ETA
              </BaseButton>
            </div>
          </div>
        </div>
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
          <BaseButton v-if="!incident.resolved && !showResolveForm" variant="neutral" @click="showResolveForm = true">
            {{ t('detail.markResolved') }}
          </BaseButton>
        </div>

        <!-- Resolve Form Dialog -->
        <div v-if="showResolveForm" class="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-3">
          <h3 class="text-sm font-bold text-slate-900">{{ t('detail.resolveFormTitle') }}</h3>
          
          <div class="grid grid-cols-3 gap-2">
            <div class="space-y-1">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeSurvivorsLabel') }}</label>
              <input 
                v-model.number="outcomeSurvivors" 
                type="number" 
                min="0"
                class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-slate-800 bg-white"
              />
            </div>
            <div class="space-y-1">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeInjuredLabel') }}</label>
              <input 
                v-model.number="outcomeInjured" 
                type="number" 
                min="0"
                class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-slate-800 bg-white"
              />
            </div>
            <div class="space-y-1">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeDeceasedLabel') }}</label>
              <input 
                v-model.number="outcomeDeceased" 
                type="number" 
                min="0"
                class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-slate-800 bg-white"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeDamageLabel') }}</label>
            <select v-model="outcomeStructuralDamage" class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-slate-800 bg-white">
              <option value="none">Sin daños / Despejado</option>
              <option value="minor">{{ t('category.damageValues.minor') }}</option>
              <option value="moderate">{{ t('category.damageValues.moderate') }}</option>
              <option value="severe">{{ t('category.damageValues.severe') }}</option>
              <option value="collapse">{{ t('category.damageValues.collapse') }}</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{{ t('detail.outcomeDetailsLabel') }}</label>
            <textarea 
              v-model="outcomeDetails" 
              rows="3"
              placeholder="Escribe un resumen de las labores realizadas..." 
              class="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-slate-800 bg-white"
            />
          </div>

          <div class="flex gap-2 justify-end">
            <BaseButton size="small" variant="neutral" @click="showResolveForm = false">Cancelar</BaseButton>
            <BaseButton size="small" variant="primary" :disabled="resolving" @click="doResolveWithOutcome">
              Confirmar y Cerrar Reporte
            </BaseButton>
          </div>
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

  <div v-else class="p-8 text-center text-slate-500">
    {{ t('detail.notFound') }}
  </div>
</div>
</template>

<style scoped>
.detail-page {
  background: var(--screen);
  min-height: 100%;
  padding-bottom: 40px;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.wrap {
  margin: 0 auto;
  padding: 12px 16px 24px;
}

/* Custom overrides to apply supply-theme styles to child elements */
:deep(.bg-white) {
  background-color: var(--card) !important;
}
:deep(.bg-slate-50) {
  background-color: #F6F4EF !important;
  border: 1.5px solid var(--line) !important;
}
:deep(.ring-slate-200), :deep(.ring-1) {
  border: 1.5px solid var(--line) !important;
  --tw-ring-color: transparent !important;
  box-shadow: none !important;
}
:deep(.text-slate-900), :deep(.text-slate-800) {
  color: var(--ink) !important;
}
:deep(.text-slate-700), :deep(.text-slate-600), :deep(.text-slate-500) {
  color: var(--ink2) !important;
}
:deep(.border-slate-200) {
  border-color: var(--line) !important;
}
:deep(.bg-amber-50) {
  background-color: var(--amber-bg) !important;
  color: var(--amber-c) !important;
  border: 1.5px solid var(--line) !important;
}
:deep(.text-amber-900) {
  color: var(--amber-c) !important;
}
:deep(.bg-fuchsia-50) {
  background-color: #FCEDEA !important;
  color: #B42318 !important;
  border: 1.5px solid var(--line) !important;
}
:deep(.text-fuchsia-900) {
  color: #B42318 !important;
}
</style>
