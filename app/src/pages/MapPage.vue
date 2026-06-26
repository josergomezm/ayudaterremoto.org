<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useIncidentsStore } from '../stores/incidents'
import { useSessionStore } from '../stores/session'
import { useHubsStore } from '../stores/hubs'
import IncidentCard from '../components/IncidentCard.vue'
import IncidentMap from '../components/IncidentMap.vue'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import OnboardingBanner from '../components/OnboardingBanner.vue'

const { t } = useI18n()
const store = useIncidentsStore()
const session = useSessionStore()
const hubsStore = useHubsStore()

const filterCategory = ref<'all' | 'medical' | 'structural' | 'obstruction' | 'resource'>('all')
const filterStatus = ref<'all' | 'red' | 'yellow' | 'green'>('all')
const sortBy = ref<'newest' | 'oldest' | 'severity-desc' | 'severity-asc'>('newest')
const viewMode = ref<'grid' | 'list'>('grid')
const showHubs = ref(true)

const mapHubs = computed(() => {
  return showHubs.value ? hubsStore.activeHubs : []
})

const mapKey = computed(() => {
  return `map-${showHubs.value}-${mapHubs.value.length}-${filteredActive.value.length}`
})

onMounted(() => {
  if (store.incidents.length === 0) store.fetchAll()
  hubsStore.fetchAll()
})

// Filter and sort active incidents
const filteredActive = computed(() => {
  let list = [...store.active]
  
  if (filterCategory.value !== 'all') {
    list = list.filter(i => i.category === filterCategory.value)
  }
  
  if (filterStatus.value !== 'all') {
    list = list.filter(i => i.status === filterStatus.value)
  }
  
  list.sort((a, b) => {
    if (sortBy.value === 'newest') {
      return b.createdAt.localeCompare(a.createdAt)
    } else if (sortBy.value === 'oldest') {
      return a.createdAt.localeCompare(b.createdAt)
    } else if (sortBy.value === 'severity-desc') {
      return a.triageLevel - b.triageLevel // Lower triageLevel = more severe (1 = critical)
    } else {
      return b.triageLevel - a.triageLevel
    }
  })
  
  return list
})

// Filter and sort cleared incidents
const filteredCleared = computed(() => {
  let list = [...store.cleared]
  
  if (filterCategory.value !== 'all') {
    list = list.filter(i => i.category === filterCategory.value)
  }
  
  if (filterStatus.value !== 'all') {
    list = list.filter(i => i.status === filterStatus.value)
  }
  
  list.sort((a, b) => {
    if (sortBy.value === 'newest') {
      return b.createdAt.localeCompare(a.createdAt)
    } else if (sortBy.value === 'oldest') {
      return a.createdAt.localeCompare(b.createdAt)
    } else if (sortBy.value === 'severity-desc') {
      return a.triageLevel - b.triageLevel
    } else {
      return b.triageLevel - a.triageLevel
    }
  })
  
  return list
})
</script>

<template>
  <div class="mx-auto space-y-5 p-4 max-w-4xl">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-xl font-bold text-slate-900">{{ t('map.title') }}</h1>
      </div>
      <div class="flex items-center">
        <label class="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition">
          <input type="checkbox" v-model="showHubs" class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer" />
          {{ t('hubs.mapLayerLabel') }}
        </label>
      </div>
    </header>

    <!-- Role-aware onboarding hint for unverified / civilian users -->
    <OnboardingBanner />
    <!-- Interactive map (Leaflet + OpenStreetMap) -->
    <IncidentMap :key="mapKey" :incidents="filteredActive" :hubs="mapHubs" />

    <!-- Filter and Sort Controls -->
    <div class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <!-- Category Filter -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">{{ t('map.filters.categoryLabel') }}</label>
          <select v-model="filterCategory" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
            <option value="all">{{ t('map.filters.categories.all') }}</option>
            <option value="medical">{{ t('map.filters.categories.medical') }}</option>
            <option value="structural">{{ t('map.filters.categories.structural') }}</option>
            <option value="obstruction">{{ t('map.filters.categories.obstruction') }}</option>
            <option value="resource">{{ t('map.filters.categories.resource') }}</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">{{ t('map.filters.priorityLabel') }}</label>
          <select v-model="filterStatus" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
            <option value="all">{{ t('map.filters.priorities.all') }}</option>
            <option value="red">{{ t('map.filters.priorities.red') }}</option>
            <option value="yellow">{{ t('map.filters.priorities.yellow') }}</option>
            <option value="green">{{ t('map.filters.priorities.green') }}</option>
          </select>
        </div>

        <!-- Sort By -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">{{ t('map.filters.sortByLabel') }}</label>
          <select v-model="sortBy" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
            <option value="newest">{{ t('map.filters.sortOptions.newest') }}</option>
            <option value="oldest">{{ t('map.filters.sortOptions.oldest') }}</option>
            <option value="severity-desc">{{ t('map.filters.sortOptions.severityDesc') }}</option>
            <option value="severity-asc">{{ t('map.filters.sortOptions.severityAsc') }}</option>
          </select>
        </div>

        <!-- View Mode Toggle -->
        <div class="space-y-1.5">
          <span class="block text-xs font-semibold text-slate-500">{{ t('map.filters.viewLabel') }}</span>
          <div class="flex rounded-xl bg-slate-100 p-0.5 w-max">
            <button 
              class="rounded-lg p-2 transition-all cursor-pointer flex items-center justify-center"
              :class="viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="viewMode = 'grid'"
            >
              <MaterialIcon name="grid_view" :size="18" />
            </button>
            <button 
              class="rounded-lg p-2 transition-all cursor-pointer flex items-center justify-center"
              :class="viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="viewMode = 'list'"
            >
              <MaterialIcon name="view_list" :size="18" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="store.error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ t('map.loadError') }}</p>
    <Loader v-else-if="store.loading" :label="t('common.loading')" class="py-4" />

    <!-- Empty state: no incidents at all -->
    <div
      v-else-if="store.incidents.length === 0"
      class="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8 text-center ring-1 ring-slate-200"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
        <MaterialIcon name="map" :size="26" />
      </span>
      <p class="text-sm font-medium text-slate-600">{{ t('map.empty') }}</p>
      <RouterLink
        v-if="session.isVerified"
        to="/report"
        class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        <MaterialIcon name="add_circle" :size="16" />
        {{ t('map.emptyReportCta') }}
      </RouterLink>
      <RouterLink
        v-else
        to="/verify"
        class="text-xs text-slate-500 underline underline-offset-2"
      >
        {{ t('map.emptyVerifyCta') }}
      </RouterLink>
    </div>

    <p v-else-if="filteredActive.length === 0 && filteredCleared.length === 0" class="text-sm text-slate-500">{{ t('map.filters.noResults') }}</p>

    <!-- Active Reports -->
    <section v-if="filteredActive.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('map.active') }} ({{ filteredActive.length }})</h2>
      <TransitionGroup 
        name="list" 
        tag="div" 
        :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'flex flex-col gap-3'"
      >
        <IncidentCard v-for="i in filteredActive" :key="i.id" :incident="i" />
      </TransitionGroup>
    </section>

    <!-- Cleared/Evacuated Reports -->
    <section v-if="filteredCleared.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('map.cleared') }} ({{ filteredCleared.length }})</h2>
      <div 
        :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70' : 'flex flex-col gap-3 opacity-70'"
      >
        <IncidentCard v-for="i in filteredCleared" :key="i.id" :incident="i" />
      </div>
    </section>
  </div>
</template>
