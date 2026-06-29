<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { useHubsStore } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'

const { t } = useI18n()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()
const router = useRouter()

const searchQuery = ref('')

onMounted(async () => {
  await hubsStore.fetchAll()
})

const brigades = computed(() => {
  return hubsStore.hubs.filter(h => h.hubType === 'mobile')
})

const filteredBrigades = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return brigades.value
  return brigades.value.filter(b => 
    b.name.toLowerCase().includes(q) || 
    b.address.toLowerCase().includes(q) ||
    b.contactName.toLowerCase().includes(q)
  )
})

function goToDetail(id: string) {
  router.push(`/brigades/${id}`)
}

function getWhatsAppContactUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}
</script>

<template>
  <div class="mx-auto space-y-6 p-4 max-w-4xl">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-xl font-bold text-slate-900">{{ t('hubs.titleMobile') }}</h1>
        <p class="text-sm text-slate-500">{{ t('hubs.subtitleMobile') }}</p>
      </div>
      <RouterLink
        v-if="session.can('admin') || admin.isAdmin"
        to="/hubs/create"
        class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 shadow-sm cursor-pointer"
      >
        <MaterialIcon name="add" :size="18" />
        Registrar Brigada
      </RouterLink>
    </header>

    <Loader v-if="hubsStore.loading" :label="t('common.loading')" />

    <div v-else-if="brigades.length === 0" class="flex flex-col items-center gap-3 rounded-3xl bg-slate-50 p-12 text-center border border-slate-100">
      <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <MaterialIcon name="hail" :size="32" />
      </span>
      <p class="text-sm font-semibold text-slate-500">{{ t('hubs.noBrigades') }}</p>
      <RouterLink
        v-if="session.can('admin') || admin.isAdmin"
        to="/hubs/create"
        class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 cursor-pointer"
      >
        <MaterialIcon name="add" :size="16" />
        Registrar Primera Brigada
      </RouterLink>
    </div>

    <template v-else>
      <!-- Search Input -->
      <div class="relative">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <MaterialIcon name="search" :size="20" />
        </span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar brigada por nombre, ubicación o contacto..."
          class="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-sm transition-all bg-white shadow-sm"
        />
      </div>

      <!-- Brigades Grid -->
      <div v-if="filteredBrigades.length === 0" class="text-center py-10 text-sm text-slate-500">
        No se encontraron brigadas que coincidan con la búsqueda.
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div 
          v-for="b in filteredBrigades" 
          :key="b.id"
          @click="goToDetail(b.id)"
          class="group flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition duration-200 cursor-pointer relative"
        >
          <div class="space-y-4">
            <!-- Header -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                  🚨 Brigada Móvil
                </span>
                <h3 class="text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors mt-1.5">{{ b.name }}</h3>
              </div>
              <span 
                class="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                :class="b.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'"
              >
                {{ b.status === 'active' ? t('hubs.statusActive') : t('hubs.statusClosed') }}
              </span>
            </div>

            <!-- Focus area -->
            <div class="text-xs text-slate-600 flex items-start gap-1.5">
              <MaterialIcon name="explore" :size="16" class="text-slate-400 shrink-0 mt-0.5" />
              <span>Base / Zona de operación: <strong class="text-slate-800">{{ b.address }}</strong></span>
            </div>

            <!-- Contact info -->
            <div class="text-xs text-slate-600 flex items-center justify-between pt-1 border-t border-slate-100">
              <div class="flex items-center gap-1.5">
                <MaterialIcon name="person" :size="16" class="text-slate-400" />
                <span>Enlace: <strong class="text-slate-800">{{ b.contactName }}</strong></span>
              </div>
              <a 
                v-if="b.contactPhone"
                :href="getWhatsAppContactUrl(b.contactPhone)" 
                target="_blank"
                @click.stop
                class="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
              >
                <MaterialIcon name="chat" :size="14" />
                <span>WhatsApp</span>
              </a>
            </div>

            <!-- Coordinators/Leaders list -->
            <div v-if="b.coordinators && b.coordinators.length" class="space-y-1.5 pt-2 border-t border-slate-100">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coordinadores de la Unidad</span>
              <div class="flex flex-wrap gap-1.5">
                <span 
                  v-for="c in b.coordinators" 
                  :key="c.email"
                  class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                >
                  {{ c.name || c.email }}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-5 flex items-center justify-end text-xs font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors gap-0.5">
            <span>{{ t('hubs.viewRoster') }}</span>
            <MaterialIcon name="chevron_right" :size="16" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
