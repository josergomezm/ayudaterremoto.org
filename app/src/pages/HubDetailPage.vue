<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useHubsStore, type ResourceHub } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import IncidentMap from '../components/IncidentMap.vue'
import { formatRelativeTime } from '../lib/date'
import { useToast } from '../lib/toast'
import type { InventoryItem } from '../stores/hubs'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()
const toast = useToast()

const hubId = computed(() => String(route.params.id))
const hub = computed(() => hubsStore.hubs.find(h => h.id === hubId.value))

onMounted(async () => {
  if (hubsStore.hubs.length === 0) {
    await hubsStore.fetchAll()
  }
  if (hub.value) {
    await hubsStore.fetchLogs(hubId.value)
  }
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
  return diffMs > 2 * 60 * 60 * 1000 // 2 hours
}

const canManage = computed(() => {
  if (!hub.value) return false
  if (admin.isAdmin) return true // Organizador+ supervisa todas las zonas
  if (hub.value.createdBy === session.email) return true
  const coords = (hub.value as any).coordinators
  if (coords && Array.isArray(coords)) {
    return coords.some((c: any) => c.email === session.email)
  }
  return false
})

// ── Need lifecycle (WS3) ─────────────────────────────────────────────────
const canClaim = computed(() => session.isVerified || admin.isAdmin)
function needStatus(item: InventoryItem) { return item.status || 'abierta' }

async function doClaim(item: InventoryItem) {
  const eta = window.prompt(t('hubs.promptEta'), '2 horas')
  if (eta === null) return // User cancelled
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
  <div v-if="hub" class="mx-auto space-y-5 p-4 max-w-4xl">
    <!-- Back Button -->
    <button 
      class="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 transition cursor-pointer" 
      @click="router.back()"
    >
      <MaterialIcon name="arrow_back" :size="18" /> 
      <span>{{ t('common.back') }}</span>
    </button>

    <!-- Map Display -->
    <IncidentMap :incidents="[]" :hubs="[hub]" />

    <!-- Hub Header & Status Bar -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-bold text-slate-900">{{ hub.name }}</h1>
            
            <!-- Status Badge -->
            <span 
              class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
              :class="hub.status === 'active' 
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' 
                : 'bg-slate-50 text-slate-600 ring-slate-500/10'"
            >
              {{ hub.status === 'active' ? t('hubs.statusActive') : t('hubs.statusClosed') }}
            </span>

            <!-- Stale Warning -->
            <span 
              v-if="isStale(hub.updatedAt)" 
              class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/10"
            >
              <MaterialIcon name="warning" :size="12" />
              <span>{{ t('hubs.staleWarning') }}</span>
            </span>
          </div>
          <p class="text-sm text-slate-500 flex items-start gap-1">
            <MaterialIcon name="location_on" :size="16" class="text-slate-400 shrink-0 mt-0.5" />
            <span>{{ hub.address }}</span>
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <!-- WhatsApp Contact -->
          <a 
            :href="getWhatsAppContactUrl(hub.contactPhone)"
            target="_blank"
            class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm cursor-pointer"
            :title="t('hubs.whatsappContact')"
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
            :title="t('hubs.whatsappGroup')"
          >
            <MaterialIcon name="groups" :size="18" />
            <span>{{ t('hubs.whatsappGroup') || 'WhatsApp' }}</span>
          </a>

          <!-- WhatsApp Share -->
          <a 
            :href="getWhatsAppShareUrl(hub)"
            target="_blank"
            class="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition cursor-pointer"
            :title="t('hubs.shareWhatsApp')"
          >
            <MaterialIcon name="share" :size="18" />
            <span>{{ t('hubs.shareWhatsApp') }}</span>
          </a>

          <!-- Admin Manage Link -->
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
        <div><strong>{{ t('hubs.contactName') }}:</strong> {{ hub.contactName }}</div>
        <div><strong>{{ t('hubs.lastUpdate') }}:</strong> {{ formatRelativeTime(hub.updatedAt, locale) }}</div>
      </div>
    </div>

    <!-- Inventory Display -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.inventory') }}</h2>
      
      <div v-if="hub.inventory.length === 0" class="text-sm text-slate-500 italic py-4">
        {{ t('hubs.emptyInventory') }}
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div 
          v-for="item in hub.inventory" 
          :key="item.id"
          class="p-4 rounded-xl ring-1 flex flex-col justify-between gap-2"
          :class="{
            'bg-emerald-50/50 ring-emerald-100': item.urgency === 'available',
            'bg-amber-50/50 ring-amber-100': item.urgency === 'low',
            'bg-red-50/50 ring-red-100': item.urgency === 'depleted'
          }"
        >
          <div>
            <h3 class="font-bold text-slate-800">{{ item.name }}</h3>
            <p class="text-xs text-slate-500 mt-0.5 capitalize">{{ t(`hubs.categories.${item.category}`) }}</p>
          </div>
          
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50">
            <span class="text-lg font-extrabold text-slate-900">
              {{ item.quantity }} <span class="text-xs font-semibold text-slate-500">{{ item.unit }}</span>
            </span>
            
            <span 
              class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
              :class="{
                'bg-emerald-100 text-emerald-800 ring-emerald-600/20': item.urgency === 'available',
                'bg-amber-100 text-amber-800 ring-amber-600/20': item.urgency === 'low',
                'bg-red-100 text-red-800 ring-red-600/20': item.urgency === 'depleted'
              }"
            >
              {{ t(`hubs.urgency.${item.urgency}`) }}
            </span>
          </div>

          <!-- Need lifecycle (WS3): abierta → tomada → confirmada -->
          <div class="mt-2 pt-2 border-t border-slate-200/50 space-y-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                :class="{
                  'bg-slate-100 text-slate-700 ring-slate-500/20': needStatus(item) === 'abierta',
                  'bg-blue-100 text-blue-800 ring-blue-600/20': needStatus(item) === 'tomada',
                  'bg-emerald-100 text-emerald-800 ring-emerald-600/20': needStatus(item) === 'confirmada'
                }"
              >
                {{ t('hubs.needStatus.' + needStatus(item)) }}
              </span>
              <span
                v-if="item.staleClaim"
                class="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20"
              >
                <MaterialIcon name="schedule" :size="11" /> {{ t('hubs.needStale') }}
              </span>
            </div>

            <!-- abierta → Me encargo -->
            <button
              v-if="needStatus(item) === 'abierta' && canClaim"
              class="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 cursor-pointer"
              @click="doClaim(item)"
            >
              <MaterialIcon name="volunteer_activism" :size="14" /> {{ t('hubs.needClaim') }}
            </button>

            <!-- tomada → quién se encargó + WhatsApp + (coordinador) confirmar/reabrir -->
            <template v-else-if="needStatus(item) === 'tomada'">
              <p class="text-[11px] text-slate-600 inline-flex items-center gap-1">
                <MaterialIcon name="person" :size="12" class="text-slate-400" />
                {{ t('hubs.needClaimedBy', { name: item.claimedByName || t('hubs.needSomeone') }) }}
              </p>
              <p v-if="item.eta" class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 mt-1 mb-2">
                <MaterialIcon name="schedule" :size="11" />
                <span>ETA: {{ item.eta }}</span>
              </p>
              <a
                :href="getWhatsAppContactUrl(hub.contactPhone)"
                target="_blank"
                class="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 cursor-pointer"
              >
                <MaterialIcon name="chat" :size="14" /> {{ t('hubs.whatsappContact') }}
              </a>
              <div v-if="canManage" class="flex gap-2">
                <button
                  class="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 cursor-pointer"
                  @click="doConfirm(item)"
                >
                  <MaterialIcon name="check" :size="14" /> {{ t('hubs.needConfirm') }}
                </button>
                <button
                  class="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 cursor-pointer"
                  @click="doReopen(item)"
                >
                  {{ t('hubs.needReopen') }}
                </button>
              </div>
            </template>

            <!-- confirmada → badge + comprobante + (coordinador) reabrir -->
            <template v-else-if="needStatus(item) === 'confirmada'">
              <p class="text-[11px] font-medium text-emerald-700 inline-flex items-center gap-1">
                <MaterialIcon name="task_alt" :size="12" /> {{ t('hubs.needConfirmedLabel') }}
              </p>
              <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" class="block text-[11px] text-indigo-600 underline">
                {{ t('hubs.needProof') }}
              </a>
              <button
                v-if="canManage"
                class="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 cursor-pointer"
                @click="doReopen(item)"
              >
                {{ t('hubs.needReopen') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Coordinators Section -->
    <div v-if="hub.coordinators && hub.coordinators.length" class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.coordinators') }}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div 
          v-for="coord in hub.coordinators" 
          :key="coord.email"
          class="p-3 rounded-xl ring-1 ring-slate-100 bg-slate-50/50 flex items-center gap-3"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <MaterialIcon name="person" :size="20" />
          </span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate" :title="coord.email">{{ coord.email }}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">
              {{ coord.email === hub.createdBy ? t('hubs.creator') : 'Co-coordinador' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Log Timeline -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.activityLog') }}</h2>
      
      <div v-if="!hub.recentLogs || hub.recentLogs.length === 0" class="text-sm text-slate-500 italic py-4">
        {{ t('hubs.emptyLog') }}
      </div>

      <div v-else class="flow-root">
        <ul role="list" class="-mb-8">
          <li v-for="(log, logIdx) in hub.recentLogs" :key="log.id">
            <div class="relative pb-8">
              <!-- Connector line -->
              <span 
                v-if="logIdx !== hub.recentLogs.length - 1" 
                class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" 
                aria-hidden="true" 
              />
              
              <div class="relative flex space-x-3">
                <div>
                  <span 
                    class="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white"
                    :class="{
                      'bg-emerald-50 text-emerald-700': log.action === 'restock',
                      'bg-amber-50 text-amber-700': log.action === 'distribute',
                      'bg-blue-50 text-blue-700': log.action === 'adjust'
                    }"
                  >
                    <MaterialIcon 
                      :name="log.action === 'restock' ? 'archive' : log.action === 'distribute' ? 'unarchive' : 'settings'" 
                      :size="16" 
                    />
                  </span>
                </div>
                
                <div class="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p class="text-sm text-slate-800">
                      <span class="font-semibold">{{ log.quantityDelta > 0 ? '+' : '' }}{{ log.quantityDelta }}</span> {{ log.itemName }} 
                      <span class="text-xs text-slate-500 ml-1">
                        ({{ log.action === 'restock' ? t('hubs.logRestock') : log.action === 'distribute' ? t('hubs.logDistribute') : t('hubs.logAdjust') }})
                      </span>
                    </p>
                    <p v-if="log.note" class="text-xs text-slate-500 mt-1 italic pl-2 border-l-2 border-slate-200 bg-slate-50/50 py-0.5 rounded">
                      "{{ log.note }}"
                    </p>
                  </div>
                  <div class="text-right text-xs whitespace-nowrap text-slate-500">
                    {{ formatRelativeTime(log.timestamp, locale) }}
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else class="py-10">
    <Loader :label="t('common.loading')" />
  </div>
</template>
