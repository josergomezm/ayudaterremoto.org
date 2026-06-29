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
const filterAssignment = ref<'all' | 'mine' | 'unassigned'>('all')
const filterAge = ref<'all' | 'stale'>('all')
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

  if (filterAssignment.value === 'mine') {
    list = list.filter(i => i.assignedTo === session.user?.uid)
  } else if (filterAssignment.value === 'unassigned') {
    list = list.filter(i => !i.assignedTo || i.assignmentStatus === 'unassigned')
  }

  if (filterAge.value === 'stale') {
    list = list.filter(i => {
      const date = new Date(i.createdAt)
      if (isNaN(date.getTime())) return false
      const diffMs = Date.now() - date.getTime()
      return diffMs >= 72 * 60 * 60 * 1000
    })
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

  if (filterAssignment.value === 'mine') {
    list = list.filter(i => i.assignedTo === session.user?.uid)
  } else if (filterAssignment.value === 'unassigned') {
    list = list.filter(i => !i.assignedTo || i.assignmentStatus === 'unassigned')
  }

  if (filterAge.value === 'stale') {
    list = list.filter(i => {
      const date = new Date(i.createdAt)
      if (isNaN(date.getTime())) return false
      const diffMs = Date.now() - date.getTime()
      return diffMs >= 72 * 60 * 60 * 1000
    })
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
  <div class="supply-theme map-page">
    <div class="wrap space-y-5">
      <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl font-extrabold text-[var(--ink)] tracking-tight">{{ t('map.title') }}</h1>
        </div>
        <div class="flex items-center">
          <label class="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-[var(--ink2)] shadow-sm border border-[var(--line)] hover:bg-[#F6F4EF] transition">
            <input type="checkbox" v-model="showHubs" class="h-4 w-4 rounded border-[var(--line)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer" />
            {{ t('hubs.mapLayerLabel') }}
          </label>
        </div>
      </header>

      <!-- Role-aware onboarding hint for unverified / civilian users -->
      <OnboardingBanner />
      <!-- Interactive map (Leaflet + OpenStreetMap) -->
      <IncidentMap :key="mapKey" :incidents="filteredActive" :hubs="mapHubs" />

      <!-- Filter and Sort Controls -->
      <div class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-[var(--line)]">
        <div class="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <!-- Category Filter -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('map.filters.categoryLabel') }}</label>
            <select v-model="filterCategory" class="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--primary)]">
              <option value="all">{{ t('map.filters.categories.all') }}</option>
              <option value="medical">{{ t('map.filters.categories.medical') }}</option>
              <option value="structural">{{ t('map.filters.categories.structural') }}</option>
              <option value="obstruction">{{ t('map.filters.categories.obstruction') }}</option>
              <option value="resource">{{ t('map.filters.categories.resource') }}</option>
            </select>
          </div>

          <!-- Status Filter -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('map.filters.priorityLabel') }}</label>
            <select v-model="filterStatus" class="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--primary)]">
              <option value="all">{{ t('map.filters.priorities.all') }}</option>
              <option value="red">{{ t('map.filters.priorities.red') }}</option>
              <option value="yellow">{{ t('map.filters.priorities.yellow') }}</option>
              <option value="green">{{ t('map.filters.priorities.green') }}</option>
            </select>
          </div>

          <!-- Assignment Filter -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('map.filters.assignmentLabel') }}</label>
            <select v-model="filterAssignment" class="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--primary)]">
              <option value="all">{{ t('map.filters.assignments.all') }}</option>
              <option value="mine">{{ t('map.filters.assignments.mine') }}</option>
              <option value="unassigned">{{ t('map.filters.assignments.unassigned') }}</option>
            </select>
          </div>

          <!-- Age Filter -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('map.filters.ageLabel') }}</label>
            <select v-model="filterAge" class="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--primary)]">
              <option value="all">{{ t('map.filters.ages.all') }}</option>
              <option value="stale">{{ t('map.filters.ages.stale') }}</option>
            </select>
          </div>

          <!-- Sort By -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('map.filters.sortByLabel') }}</label>
            <select v-model="sortBy" class="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--primary)]">
              <option value="newest">{{ t('map.filters.sortOptions.newest') }}</option>
              <option value="oldest">{{ t('map.filters.sortOptions.oldest') }}</option>
              <option value="severity-desc">{{ t('map.filters.sortOptions.severityDesc') }}</option>
              <option value="severity-asc">{{ t('map.filters.sortOptions.severityAsc') }}</option>
            </select>
          </div>

          <!-- View Mode Toggle -->
          <div class="space-y-1.5">
            <span class="block text-[10px] font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('map.filters.viewLabel') }}</span>
            <div class="flex rounded-xl bg-[#ECE7DF] p-0.5 w-max">
              <button 
                class="rounded-lg p-2 transition-all cursor-pointer flex items-center justify-center"
                :class="viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-700'"
                @click="viewMode = 'grid'"
              >
                <MaterialIcon name="grid_view" :size="18" />
              </button>
              <button 
                class="rounded-lg p-2 transition-all cursor-pointer flex items-center justify-center"
                :class="viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-700'"
                @click="viewMode = 'list'"
              >
                <MaterialIcon name="view_list" :size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="store.error" class="rounded-lg bg-[var(--red-bg)] p-3 text-sm text-[var(--red-c)] border border-[var(--line)]">{{ t('map.loadError') }}</p>
      <Loader v-else-if="store.loading" :label="t('common.loading')" class="py-4" />

      <!-- Empty state: no incidents at all -->
      <div
        v-else-if="store.incidents.length === 0"
        class="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center border border-[var(--line)] shadow-sm"
      >
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFEBE3] text-[var(--ink2)]">
          <MaterialIcon name="map" :size="26" />
        </span>
        <p class="text-sm font-bold text-[var(--ink)]">{{ t('map.empty') }}</p>
        <RouterLink
          v-if="session.isVerified"
          to="/report"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--primary-d)]"
        >
          <MaterialIcon name="add_circle" :size="16" />
          {{ t('map.emptyReportCta') }}
        </RouterLink>
        <RouterLink
          v-else
          to="/profile"
          class="text-xs text-[var(--primary)] font-bold underline underline-offset-2"
        >
          {{ t('map.emptyVerifyCta') }}
        </RouterLink>
      </div>

      <p v-else-if="filteredActive.length === 0 && filteredCleared.length === 0" class="text-sm text-[var(--ink2)] text-center font-medium">{{ t('map.filters.noResults') }}</p>

      <!-- Active Reports -->
      <section v-if="filteredActive.length" class="space-y-3">
        <h2 class="text-xs font-extrabold uppercase tracking-wider text-[var(--ink2)]">{{ t('map.active') }} ({{ filteredActive.length }})</h2>
        <TransitionGroup 
          name="list" 
          tag="div" 
          :class="viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'flex flex-col gap-3'"
        >
          <IncidentCard v-for="i in filteredActive" :key="i.id" :incident="i" />
        </TransitionGroup>
      </section>

      <!-- Cleared/Evacuated Reports -->
      <section v-if="filteredCleared.length" class="space-y-3">
        <h2 class="text-xs font-extrabold uppercase tracking-wider text-[var(--ink2)]">{{ t('map.cleared') }} ({{ filteredCleared.length }})</h2>
        <div 
          :class="viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-70' : 'flex flex-col gap-3 opacity-70'"
        >
          <IncidentCard v-for="i in filteredCleared" :key="i.id" :incident="i" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.map-page {
  background: var(--screen);
  min-height: 100%;
  padding-bottom: 40px;
}
.wrap {
  margin: 0 auto;
  padding: 12px 16px 24px;
}
</style>
