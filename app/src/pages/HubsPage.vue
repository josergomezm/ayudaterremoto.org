<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { useHubsStore, type ResourceHub } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import { formatRelativeTime } from '../lib/date'

const { t, locale } = useI18n()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()

const router = useRouter()

const qrHub = ref<ResourceHub | null>(null)

function goToDetail(id: string) {
  router.push(`/hubs/${id}`)
}

onMounted(() => {
  hubsStore.fetchAll()
})

function getHubUrl(id: string) {
  return `${window.location.origin}/hubs/${id}`
}

function getWhatsAppShareUrl(hub: ResourceHub) {
  const url = getHubUrl(hub.id)
  return `https://wa.me/?text=${encodeURIComponent(
    t('hubs.shareMessage', {
      name: hub.name,
      address: hub.address,
      phone: hub.contactPhone,
      url: url
    })
  )}`
}

function getWhatsAppContactUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

function isStale(updatedAtStr: string) {
  if (!updatedAtStr) return false
  const updated = new Date(updatedAtStr)
  const diffMs = new Date().getTime() - updated.getTime()
  return diffMs > 2 * 60 * 60 * 1000 // 2 hours
}

function canManage(hub: ResourceHub) {
  if (admin.isAdmin) return true // Organizador+ supervisa todas las zonas
  if (hub.createdBy === session.email) return true
  const coords = (hub as any).coordinators
  if (coords && Array.isArray(coords)) {
    return coords.some((c: any) => c.email === session.email)
  }
  return false
}
</script>

<template>
  <div class="mx-auto space-y-5 p-4 max-w-4xl">
    <header class="flex items-center justify-between">
      <div class="space-y-1">
        <h1 class="text-xl font-bold text-slate-900">{{ t('hubs.title') }}</h1>
        <p class="text-sm text-slate-500">{{ t('hubs.subtitle') }}</p>
      </div>
      <RouterLink
        v-if="session.can('coordinador') || admin.isAdmin"
        to="/hubs/create"
        class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 shadow-sm cursor-pointer"
      >
        <MaterialIcon name="add_circle" :size="18" />
        {{ t('hubs.createHub') }}
      </RouterLink>
    </header>

    <Loader v-if="hubsStore.loading" :label="t('common.loading')" />

    <div v-else-if="hubsStore.hubs.length === 0" class="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8 text-center ring-1 ring-slate-200">
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
        <MaterialIcon name="storefront" :size="26" />
      </span>
      <p class="text-sm font-medium text-slate-600">{{ t('hubs.noHubs') }}</p>
      <RouterLink
        v-if="session.can('coordinador') || admin.isAdmin"
        to="/hubs/create"
        class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 cursor-pointer"
      >
        <MaterialIcon name="add_circle" :size="16" />
        {{ t('hubs.createHub') }}
      </RouterLink>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        v-for="hub in hubsStore.hubs" 
        :key="hub.id"
        :id="`hub-${hub.id}`"
        @click="goToDetail(hub.id)"
        class="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 relative overflow-hidden cursor-pointer hover:shadow-md hover:ring-slate-300 transition duration-200"
      >
        <!-- Stale Warning Indicator -->
        <div 
          v-if="isStale(hub.updatedAt)" 
          class="absolute top-0 right-0 left-0 bg-amber-500 text-white text-[11px] font-semibold py-1 px-3 flex items-center justify-center gap-1"
        >
          <MaterialIcon name="warning" :size="14" />
          <span>{{ t('hubs.staleWarning') }}</span>
        </div>

        <div :class="{ 'mt-5': isStale(hub.updatedAt) }" class="space-y-4">
          <!-- Hub Header Info -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold text-slate-900">{{ hub.name }}</h3>
              <p class="text-sm text-slate-500 flex items-start gap-1 mt-1">
                <MaterialIcon name="location_on" :size="16" class="text-slate-400 shrink-0 mt-0.5" />
                <span>{{ hub.address }}</span>
              </p>
            </div>
            
            <div class="flex items-center gap-1.5">
              <!-- QR Button -->
              <button 
                @click.stop="qrHub = hub"
                class="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                :title="t('hubs.qrCode')"
              >
                <MaterialIcon name="qr_code" :size="20" />
              </button>
              
              <!-- Status Badge -->
              <span 
                class="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset"
                :class="hub.status === 'active' 
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' 
                  : 'bg-slate-50 text-slate-600 ring-slate-500/10'"
              >
                {{ hub.status === 'active' ? t('hubs.statusActive') : t('hubs.statusClosed') }}
              </span>
            </div>
          </div>

          <!-- Inventory Section -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ t('hubs.inventory') }}</h4>
            <div v-if="hub.inventory.length === 0" class="text-xs text-slate-500 italic">
              {{ t('hubs.emptyInventory') }}
            </div>
            <div v-else class="flex flex-wrap gap-1.5">
              <span 
                v-for="item in hub.inventory" 
                :key="item.id"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="{
                  'bg-emerald-50 text-emerald-700 ring-emerald-600/10': item.urgency === 'available',
                  'bg-amber-50 text-amber-700 ring-amber-600/10': item.urgency === 'low',
                  'bg-red-50 text-red-700 ring-red-600/10': item.urgency === 'depleted'
                }"
              >
                {{ item.quantity }}{{ item.unit }} {{ item.name }}
              </span>
            </div>
          </div>

          <!-- Recent Logs Section -->
          <div v-if="hub.recentLogs && hub.recentLogs.length" class="space-y-1.5 pt-2 border-t border-slate-100">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ t('hubs.activityLog') }}</h4>
            <ul class="space-y-1 text-xs text-slate-600">
              <li 
                v-for="log in hub.recentLogs.slice(0, 3)" 
                :key="log.id"
                class="flex items-center justify-between gap-2"
              >
                <span class="truncate">
                  <span v-if="log.action === 'restock'">📦</span>
                  <span v-else-if="log.action === 'distribute'">📤</span>
                  <span v-else>⚙️</span>
                  <span class="font-medium ml-1">
                    {{ log.quantityDelta > 0 ? '+' : '' }}{{ log.quantityDelta }} {{ log.itemName }}
                  </span>
                </span>
                <span class="text-slate-400 shrink-0">{{ formatRelativeTime(log.timestamp, locale) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Card Footer Actions -->
        <div class="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2 items-center justify-between">
          <div class="flex gap-1.5">
            <!-- Contact Whatsapp (Icon-only) -->
            <a 
              :href="getWhatsAppContactUrl(hub.contactPhone)"
              target="_blank"
              @click.stop
              class="inline-flex items-center justify-center rounded-xl bg-emerald-600 p-2.5 text-white transition hover:bg-emerald-700 shadow-sm cursor-pointer"
              :title="t('hubs.whatsappContact')"
            >
              <MaterialIcon name="chat" :size="20" />
            </a>

            <!-- WhatsApp Group Link (Icon-only) -->
            <a 
              v-if="hub.whatsappGroup"
              :href="hub.whatsappGroup"
              target="_blank"
              @click.stop
              class="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 p-2.5 text-white transition shadow-sm cursor-pointer"
              :title="t('hubs.whatsappGroup') || 'Grupo de WhatsApp'"
            >
              <MaterialIcon name="groups" :size="20" />
            </a>

            <!-- Share WhatsApp (Icon-only) -->
            <a 
              :href="getWhatsAppShareUrl(hub)"
              target="_blank"
              @click.stop
              class="inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 p-2.5 text-slate-700 transition cursor-pointer"
              :title="t('hubs.shareWhatsApp')"
            >
              <MaterialIcon name="share" :size="20" />
            </a>
          </div>

          <!-- Manage Link -->
          <RouterLink
            v-if="canManage(hub)"
            :to="`/hubs/${hub.id}/manage`"
            @click.stop
            class="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700 shadow-sm cursor-pointer"
          >
            <MaterialIcon name="settings" :size="16" />
            {{ t('hubs.manageHub') }}
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- QR Code Modal -->
    <div v-if="qrHub" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 text-center space-y-4">
        <button 
          @click="qrHub = null" 
          class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer"
        >
          <MaterialIcon name="close" :size="24" />
        </button>
        
        <h3 class="text-lg font-bold text-slate-900">{{ t('hubs.qrCode') }}</h3>
        <p class="text-sm text-slate-500">{{ qrHub.name }}</p>
        
        <div class="flex justify-center py-4">
          <img 
            :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getHubUrl(qrHub.id))}`" 
            :alt="qrHub.name"
            class="h-48 w-48 rounded-lg shadow-sm border border-slate-100"
          />
        </div>
        
        <p class="text-xs text-slate-400">
          {{ t('hubs.qrDescription') }}
        </p>
      </div>
    </div>
  </div>
</template>
