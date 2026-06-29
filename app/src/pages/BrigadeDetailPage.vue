<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useHubsStore, type ResourceHub, type InventoryItem } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore, type Responder } from '../stores/admin'
import { useIncidentsStore } from '../stores/incidents'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import IncidentMap from '../components/IncidentMap.vue'
import { formatRelativeTime } from '../lib/date'
import { useToast } from '../lib/toast'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()
const incidentsStore = useIncidentsStore()
const toast = useToast()

const hubId = computed(() => String(route.params.id))
const hub = computed(() => hubsStore.hubs.find(h => h.id === hubId.value))

const responders = ref<Responder[]>([])
const loadingResponders = ref(false)

onMounted(async () => {
  if (hubsStore.hubs.length === 0) {
    await hubsStore.fetchAll()
  }
  if (hub.value) {
    await hubsStore.fetchLogs(hubId.value)
    
    // Load incidents to check active assignments
    await incidentsStore.fetchAll()

    // If coordinator or admin, fetch full responders list
    if (session.can('coordinator') || admin.isAdmin) {
      loadingResponders.value = true
      try {
        const res = await admin.listResponders()
        if (res.ok) {
          responders.value = res.data.responders.filter(r => r.joinedHubId === hubId.value)
        }
      } catch (err) {
        console.error(err)
      } finally {
        loadingResponders.value = false
      }
    }
  }
})

const canManage = computed(() => {
  if (!hub.value) return false
  if (admin.isAdmin) return true
  if (hub.value.createdBy === session.email) return true
  const coords = (hub.value as any).coordinators
  if (coords && Array.isArray(coords)) {
    return coords.some((c: any) => c.email === session.email)
  }
  return false
})

const publicMembers = computed(() => {
  if (!hub.value) return []
  const coords = hub.value.coordinators || []
  return coords.map(c => ({
    email: c.email,
    name: c.name || c.email,
    role: 'coordinator'
  }))
})

const displayMembers = computed(() => {
  // If we loaded verified responders, merge/display them
  if (responders.value.length > 0) {
    return responders.value.map(r => ({
      email: r.email,
      name: r.name || r.email,
      role: r.role
    }))
  }
  // Otherwise fall back to public coordinators list
  return publicMembers.value
})

const activeIncidents = computed(() => {
  const memberEmails = displayMembers.value.map(m => m.email.toLowerCase())
  return incidentsStore.incidents.filter(inc => {
    if (!inc.assignedTo) return false
    return memberEmails.includes(inc.assignedTo.toLowerCase()) && !inc.resolved
  })
})

function getWhatsAppContactUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

function getWhatsAppShareUrl(hub: ResourceHub) {
  const url = window.location.href
  return `https://wa.me/?text=${encodeURIComponent(
    t('hubs.shareMessage', {
      name: hub.name,
      address: hub.address,
      phone: hub.contactPhone,
      url: url
    })
  )}`
}

function isStale(updatedAtStr: string) {
  if (!updatedAtStr) return false
  const updated = new Date(updatedAtStr)
  const diffMs = new Date().getTime() - updated.getTime()
  return diffMs > 2 * 60 * 60 * 1000
}

// Need lifecycle actions
const canClaim = computed(() => session.isVerified || admin.isAdmin)
function needStatus(item: InventoryItem) { return item.status || 'abierta' }

async function doClaim(item: InventoryItem) {
  const eta = window.prompt(t('hubs.promptEta'), '2 horas')
  if (eta === null) return
  const r = await hubsStore.claimNeed(hubId.value, item.id, session.name ?? undefined, eta || undefined)
  if (r.ok) toast.success(t('hubs.needClaimed'))
  else toast.error(r.error || t('common.error'))
}

async function doConfirm(item: InventoryItem) {
  const r = await hubsStore.confirmNeed(hubId.value, item.id)
  if (r.ok) toast.success(t('hubs.needConfirmed'))
  else toast.error(r.error || t('common.error'))
}

async function doReopen(item: InventoryItem) {
  const r = await hubsStore.reopenNeed(hubId.value, item.id)
  if (r.ok) toast.success(t('hubs.needReopened'))
  else toast.error(r.error || t('common.error'))
}
</script>

<template>
  <div v-if="hub" class="mx-auto space-y-6 p-4 max-w-4xl">
    <!-- Back Button -->
    <button 
      class="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 transition cursor-pointer" 
      @click="router.push('/brigades')"
    >
      <MaterialIcon name="arrow_back" :size="18" /> 
      <span>{{ t('hubs.backToBrigades') }}</span>
    </button>

    <!-- Map Position -->
    <IncidentMap :incidents="[]" :hubs="[hub]" />

    <!-- Brigade Detail Header -->
    <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
              🚨 Brigada de Rescate
            </span>
            <h1 class="text-xl font-black text-slate-900 w-full sm:w-auto mt-1 sm:mt-0">{{ hub.name }}</h1>
            
            <!-- Status Badge -->
            <span 
              class="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              :class="hub.status === 'active' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-slate-50 text-slate-500'"
            >
              {{ hub.status === 'active' ? t('hubs.statusActive') : t('hubs.statusClosed') }}
            </span>

            <!-- Stale Warning -->
            <span 
              v-if="isStale(hub.updatedAt)" 
              class="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
            >
              <MaterialIcon name="warning" :size="12" />
              <span>{{ t('hubs.staleWarning') }}</span>
            </span>
          </div>
          <p class="text-sm text-slate-500 flex items-start gap-1">
            <MaterialIcon name="explore" :size="16" class="text-slate-400 shrink-0 mt-0.5" />
            <span>Zona base: {{ hub.address }}</span>
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <!-- WhatsApp Contact -->
          <a 
            v-if="hub.contactPhone"
            :href="getWhatsAppContactUrl(hub.contactPhone)"
            target="_blank"
            class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm cursor-pointer"
          >
            <MaterialIcon name="chat" :size="18" />
            <span>{{ t('hubs.whatsappContact') }}</span>
          </a>

          <!-- WhatsApp Group -->
          <a 
            v-if="hub.whatsappGroup"
            :href="hub.whatsappGroup"
            target="_blank"
            class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition shadow-sm cursor-pointer"
          >
            <MaterialIcon name="groups" :size="18" />
            <span>Grupo WhatsApp</span>
          </a>

          <!-- Share -->
          <a 
            :href="getWhatsAppShareUrl(hub)"
            target="_blank"
            class="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition cursor-pointer"
          >
            <MaterialIcon name="share" :size="18" />
            <span>{{ t('hubs.shareWhatsApp') }}</span>
          </a>

          <!-- Manage -->
          <RouterLink
            v-if="canManage"
            :to="`/hubs/${hub.id}/manage`"
            class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 shadow-sm cursor-pointer"
          >
            <MaterialIcon name="settings" :size="18" />
            <span>{{ t('hubs.manageHub') }}</span>
          </RouterLink>
        </div>
      </div>

      <div class="border-t border-slate-100 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500">
        <div><strong>Líder de contacto:</strong> {{ hub.contactName }}</div>
        <div><strong>Último reporte:</strong> {{ formatRelativeTime(hub.updatedAt, locale) }}</div>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left side: Brigade Needs/Resources (2 cols wide) -->
      <div class="lg:col-span-2 space-y-6">
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MaterialIcon name="shopping_basket" :size="18" class="text-slate-400" />
            Necesidades operativas de la Brigada
          </h2>
          
          <div v-if="hub.inventory.length === 0" class="text-sm text-slate-500 italic py-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
            {{ t('hubs.emptyInventory') }}
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              v-for="item in hub.inventory" 
              :key="item.id"
              class="flex flex-col justify-between p-4 rounded-2xl border transition hover:shadow-sm"
              :class="{
                'bg-emerald-50/50 border-emerald-100': needStatus(item) === 'confirmada',
                'bg-amber-50/30 border-amber-100': needStatus(item) === 'tomada',
                'bg-white border-slate-200': needStatus(item) === 'abierta',
              }"
            >
              <div>
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-bold text-slate-900 text-sm">{{ item.name }}</h3>
                  
                  <!-- Urgency Badge -->
                  <span 
                    class="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                    :class="{
                      'bg-emerald-50 text-emerald-700 border border-emerald-100': item.urgency === 'available',
                      'bg-amber-50 text-amber-700 border border-amber-100': item.urgency === 'low',
                      'bg-red-50 text-red-700 border border-red-100': item.urgency === 'depleted'
                    }"
                  >
                    {{ t('hubs.urgency.' + item.urgency) }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-1">Cantidad: <strong>{{ item.quantity }} {{ item.unit }}</strong></p>
                <div class="text-[10px] text-slate-400 mt-0.5">Categoría: {{ t('hubs.categories.' + item.category) }}</div>
              </div>

              <!-- Claim Actions -->
              <div class="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-xs">
                <span class="font-bold uppercase tracking-wider text-[10px]" :class="{
                  'text-emerald-700': needStatus(item) === 'confirmada',
                  'text-amber-700': needStatus(item) === 'tomada',
                  'text-slate-400': needStatus(item) === 'abierta',
                }">
                  {{ t('hubs.needStatus.' + needStatus(item)) }}
                </span>

                <div class="flex items-center gap-1.5">
                  <template v-if="needStatus(item) === 'abierta'">
                    <button 
                      v-if="canClaim"
                      @click="doClaim(item)"
                      class="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <MaterialIcon name="handshake" :size="14" />
                      {{ t('hubs.needClaim') }}
                    </button>
                  </template>
                  
                  <template v-else-if="needStatus(item) === 'tomada'">
                    <span v-if="item.claimedByName" class="text-slate-500 text-[11px] mr-1.5">
                      {{ t('hubs.needClaimedBy', { name: item.claimedByName }) }} <span v-if="item.eta" class="text-slate-400 font-normal">({{ item.eta }})</span>
                    </span>
                    <button 
                      v-if="canManage"
                      @click="doConfirm(item)"
                      class="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <MaterialIcon name="done" :size="14" />
                      {{ t('hubs.needConfirm') }}
                    </button>
                  </template>

                  <template v-else-if="needStatus(item) === 'confirmada'">
                    <span v-if="item.confirmedByName" class="text-slate-500 text-[11px] mr-1.5">
                      Entregado por: {{ item.confirmedByName }}
                    </span>
                    <button 
                      v-if="canManage"
                      @click="doReopen(item)"
                      class="text-red-600 hover:text-red-800 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <MaterialIcon name="restart_alt" :size="14" />
                      {{ t('hubs.needReopen') }}
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Brigade Roster & Active operations (1 col wide) -->
      <div class="space-y-6">
        
        <!-- Brigade Roster Card -->
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MaterialIcon name="groups" :size="18" class="text-slate-400" />
            {{ t('hubs.brigadeRoster') }}
          </h2>

          <Loader v-if="loadingResponders" :label="t('common.loading')" class="py-4" />
          <ul v-else class="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            <li 
              v-for="m in displayMembers" 
              :key="m.email"
              class="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
            >
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-800 truncate">{{ m.name }}</div>
                <div class="text-[10px] text-slate-400 font-mono truncate">{{ m.email }}</div>
              </div>
              <span 
                class="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shrink-0"
                :class="m.role === 'coordinator' ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'"
              >
                {{ m.role === 'coordinator' ? 'Coordinador' : 'Rescatista' }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Active Operations Card -->
        <div class="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MaterialIcon name="explore" :size="18" class="text-slate-400" />
            {{ t('hubs.activeOps') }}
          </h2>

          <div v-if="activeIncidents.length === 0" class="text-xs text-slate-500 italic py-4 text-center bg-slate-50 rounded-xl">
            Ninguna operación activa en este momento.
          </div>
          <ul v-else class="space-y-3">
            <li 
              v-for="inc in activeIncidents" 
              :key="inc.id"
              class="p-3 rounded-2xl border border-slate-150 hover:border-indigo-300 transition duration-150"
            >
              <RouterLink :to="`/incidents/${inc.id}`" class="block space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" :class="{
                    'bg-red-50 text-red-700': inc.triageLevel <= 2,
                    'bg-amber-50 text-amber-700': inc.triageLevel === 3,
                    'bg-emerald-50 text-emerald-700': inc.triageLevel >= 4,
                  }">
                    Nivel {{ inc.triageLevel }}
                  </span>
                  <span class="text-[9px] font-bold text-slate-500 uppercase">{{ inc.assignmentStatus || 'assigned' }}</span>
                </div>
                <p class="text-xs font-semibold text-slate-800 line-clamp-1">{{ inc.description }}</p>
                <div class="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <MaterialIcon name="person" :size="12" />
                  <span>Rescatista: {{ inc.assignedName || inc.assignedTo }}</span>
                </div>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
