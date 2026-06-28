<script setup lang="ts">
// Home rediseñado (WS5) — necesidades primero, role-aware. Recrea los frames
// 1 (Colaborador), 2 (Coordinador) y 5 (estado vacío) del handoff de Claude Design.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useHubsStore, type InventoryItem, type ResourceHub } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useOnline } from '../composables/useOnline'
import MaterialIcon from '../components/MaterialIcon.vue'
import NeedCard from '../components/NeedCard.vue'
import Loader from '../components/Loader.vue'

const { t } = useI18n()
const hubs = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()
const { online } = useOnline()

onMounted(() => { if (hubs.hubs.length === 0) hubs.fetchAll() })

// Filtros
const search = ref('')
const fUrgency = ref('')
const fCategory = ref('')
const fZone = ref('')
const openOnly = ref(true)
const view = ref<'list' | 'map'>('list')

const URGENCY_RANK: Record<string, number> = { depleted: 0, low: 1, available: 2 }
const CATEGORIES = ['water', 'food', 'medical', 'tools', 'shelter', 'clothing', 'hygiene', 'other']

interface Need { item: InventoryItem; hub: ResourceHub }

function canManage(hub: ResourceHub): boolean {
  if (admin.isAdmin) return true
  if (hub.createdBy === session.email) return true
  return (hub.coordinators ?? []).some((c) => c.email === session.email)
}
const myZone = computed<ResourceHub | undefined>(() =>
  hubs.activeHubs.find((h) => h.createdBy === session.email || (h.coordinators ?? []).some((c) => c.email === session.email)),
)
const isOpen = (i: InventoryItem) => (i.status ?? 'abierta') !== 'tomada' && (i.status ?? 'abierta') !== 'confirmada'

const allNeeds = computed<Need[]>(() =>
  hubs.activeHubs.flatMap((hub) => hub.inventory.map((item) => ({ item, hub }))),
)

const filtered = computed<Need[]>(() => {
  const q = search.value.trim().toLowerCase()
  return allNeeds.value
    .filter(({ item, hub }) => {
      if (openOnly.value && !isOpen(item)) return false
      if (fUrgency.value && item.urgency !== fUrgency.value) return false
      if (fCategory.value && item.category !== fCategory.value) return false
      if (fZone.value && hub.id !== fZone.value) return false
      if (q && !(`${item.name} ${hub.name}`.toLowerCase().includes(q))) return false
      return true
    })
    .sort((a, b) =>
      (URGENCY_RANK[a.item.urgency] ?? 3) - (URGENCY_RANK[b.item.urgency] ?? 3) ||
      a.item.name.localeCompare(b.item.name),
    )
})

const confirmedCount = computed(() => allNeeds.value.filter((n) => n.item.status === 'confirmada').length)
const openCount = computed(() => allNeeds.value.filter((n) => isOpen(n.item)).length)

// Vista coordinador (su propia zona)
const zoneNeeds = computed<Need[]>(() =>
  myZone.value ? myZone.value.inventory.map((item) => ({ item, hub: myZone.value as ResourceHub })) : [],
)
const zoneOpen = computed(() => zoneNeeds.value.filter((n) => isOpen(n.item)).length)
const zoneConfirmed = computed(() => zoneNeeds.value.filter((n) => n.item.status === 'confirmada').length)
const zoneWaiting = computed(() => zoneNeeds.value.filter((n) => n.item.status === 'tomada').length)
const zoneStale = computed(() => {
  if (!myZone.value) return false
  const diff = Date.now() - new Date(myZone.value.updatedAt).getTime()
  return diff > 2 * 60 * 60 * 1000
})

function clearFilters() { fUrgency.value = ''; fCategory.value = ''; fZone.value = ''; search.value = '' }
</script>

<template>
  <div class="supply-theme home">
    <Loader v-if="hubs.loading && hubs.hubs.length === 0" :label="t('common.loading')" />

    <template v-else>
      <!-- ───────── Vista Coordinador: Mi zona ───────── -->
      <div v-if="myZone" class="wrap">
        <div class="myzone">
          <div class="myzone-top">
            <div>
              <div class="myzone-eyebrow">{{ t('home.myZone') }}</div>
              <div class="myzone-name">{{ myZone.name }}</div>
            </div>
            <div class="zone-badge" :class="zoneStale ? 'zone-badge--amber' : 'zone-badge--green'">
              <span class="dot" :class="zoneStale ? 'dot--amber' : 'dot--green'"></span>
              {{ zoneStale ? t('home.outdated') : t('home.updated') }}
            </div>
          </div>
          <div class="myzone-stats">{{ t('home.zoneStats', { open: zoneOpen, done: zoneConfirmed }) }}</div>
          <div v-if="zoneWaiting > 0" class="myzone-wait">
            <MaterialIcon name="schedule" :size="20" />
            <span>{{ t('home.waitingConfirm', { n: zoneWaiting }) }}</span>
          </div>
          <RouterLink :to="`/hubs/${myZone.id}/manage`" class="btn-primary">
            <MaterialIcon name="add" :size="21" /> {{ t('home.newNeed') }}
          </RouterLink>
        </div>

        <div class="section-label">{{ t('home.inMyZone') }}</div>
        <div class="list">
          <NeedCard v-for="n in zoneNeeds" :key="n.item.id" :item="n.item" :hub="n.hub" mode="coordinador" />
          <div v-if="zoneNeeds.length === 0" class="muted">{{ t('hubs.emptyInventory') }}</div>
        </div>
      </div>

      <!-- ───────── Vista Colaborador: feed de necesidades ───────── -->
      <div v-else class="wrap">
        <div class="trust">
          <MaterialIcon name="check_circle" :size="16" fill class="trust-ic" />
          <span>{{ t('home.trust', { done: confirmedCount, open: openCount }) }}</span>
        </div>

        <div class="searchbar">
          <MaterialIcon name="search" :size="21" />
          <input v-model="search" :placeholder="t('home.searchPlaceholder')" />
        </div>

        <div class="chips scroll-x">
          <button class="chip" :class="{ 'chip--on': openOnly }" @click="openOnly = !openOnly">
            <MaterialIcon v-if="openOnly" name="check" :size="17" /> {{ t('home.onlyOpen') }}
          </button>
          <label class="chip chip--select">
            <select v-model="fUrgency">
              <option value="">{{ t('home.urgency') }}</option>
              <option value="depleted">{{ t('hubs.urgency.depleted') }}</option>
              <option value="low">{{ t('hubs.urgency.low') }}</option>
              <option value="available">{{ t('hubs.urgency.available') }}</option>
            </select>
            <MaterialIcon name="expand_more" :size="18" />
          </label>
          <label class="chip chip--select">
            <select v-model="fCategory">
              <option value="">{{ t('home.category') }}</option>
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t('hubs.categories.' + c) }}</option>
            </select>
            <MaterialIcon name="expand_more" :size="18" />
          </label>
          <label class="chip chip--select">
            <select v-model="fZone">
              <option value="">{{ t('home.zone') }}</option>
              <option v-for="h in hubs.activeHubs" :key="h.id" :value="h.id">{{ h.name }}</option>
            </select>
            <MaterialIcon name="expand_more" :size="18" />
          </label>
        </div>

        <div class="toggle">
          <button :class="{ 'toggle--on': view === 'list' }" @click="view = 'list'">
            <MaterialIcon name="format_list_bulleted" :size="19" /> {{ t('home.list') }}
          </button>
          <button :class="{ 'toggle--on': view === 'map' }" @click="view = 'map'">
            <MaterialIcon name="map" :size="19" /> {{ t('home.map') }}
          </button>
        </div>

        <!-- Offline banner inline (frame 6) -->
        <div v-if="!online" class="offline">
          <MaterialIcon name="wifi_off" :size="19" /> {{ t('home.offline') }}
        </div>

        <!-- Map placeholder (Fase B) -->
        <div v-if="view === 'map'" class="map-ph">
          <MaterialIcon name="map" :size="40" />
          <p>{{ t('home.mapSoon') }}</p>
        </div>

        <!-- Lista -->
        <div v-else-if="filtered.length" class="list">
          <NeedCard
            v-for="n in filtered"
            :key="n.item.id"
            :item="n.item"
            :hub="n.hub"
            :mode="canManage(n.hub) ? 'coordinador' : 'colaborador'"
            :offline="!online"
          />
        </div>

        <!-- Estado vacío (frame 5) -->
        <div v-else class="empty">
          <div class="empty-ic"><MaterialIcon name="search_off" :size="44" /></div>
          <div class="empty-title">{{ t('home.emptyTitle') }}</div>
          <div class="empty-body">{{ t('home.emptyBody') }}</div>
          <button class="btn-ghost" @click="clearFilters">
            <MaterialIcon name="filter_alt_off" :size="20" /> {{ t('home.clearFilters') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home { background: var(--screen); min-height: 100%; }
.wrap { max-width: 560px; margin: 0 auto; padding: 12px 16px 24px; display: flex; flex-direction: column; }
.scroll-x::-webkit-scrollbar { display: none; }
.muted { font-size: 14px; color: var(--ink2); font-style: italic; padding: 8px 2px; }

/* Trust strip */
.trust { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 8px 4px; font-size: 12.5px; font-weight: 600; color: var(--ink2); }
.trust-ic { color: var(--green-dot); }

/* Search */
.searchbar { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 14px; background: #fff; border: 1px solid var(--line); border-radius: 14px; margin-top: 6px; color: var(--ink2); }
.searchbar input { border: none; outline: none; flex: 1; font-size: 15px; font-weight: 500; color: var(--ink); background: transparent; font-family: inherit; }
.searchbar input::placeholder { color: #9B9488; }

/* Chips */
.chips { display: flex; gap: 8px; margin-top: 11px; overflow-x: auto; padding-bottom: 2px; }
.chip { display: flex; align-items: center; gap: 4px; padding: 9px 13px; border: 1px solid var(--line); background: #fff; border-radius: 999px; font-size: 13.5px; font-weight: 700; color: var(--ink); flex: none; cursor: pointer; }
.chip--on { border-color: var(--primary); background: var(--primary); color: #fff; font-weight: 800; }
.chip--select { position: relative; padding-right: 8px; }
.chip--select select { appearance: none; border: none; background: transparent; font: inherit; font-weight: 700; color: var(--ink); cursor: pointer; outline: none; padding-right: 2px; }

/* List/Map toggle */
.toggle { display: flex; background: #ECE7DF; border-radius: 13px; padding: 4px; gap: 4px; margin-top: 12px; }
.toggle button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border: none; border-radius: 10px; background: transparent; font-size: 14px; font-weight: 700; color: var(--ink2); cursor: pointer; }
.toggle .toggle--on { background: #fff; box-shadow: 0 1px 3px rgba(30,26,20,.12); color: var(--ink); font-weight: 800; }

.offline { display: flex; align-items: center; gap: 9px; margin-top: 12px; padding: 11px 14px; background: #34302A; color: #F5F1EA; border-radius: 12px; font-size: 13px; font-weight: 700; }

.map-ph { margin-top: 14px; padding: 56px 20px; background: #fff; border: 1px dashed var(--line); border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--ink2); text-align: center; }

.list { display: flex; flex-direction: column; gap: 13px; margin-top: 14px; }

/* Empty state */
.empty { padding: 56px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.empty-ic { width: 88px; height: 88px; border-radius: 50%; background: #EFEBE3; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; color: #A79F90; }
.empty-title { font-size: 18px; font-weight: 800; color: var(--ink); letter-spacing: -.01em; }
.empty-body { font-size: 14px; font-weight: 500; color: var(--ink2); margin-top: 8px; line-height: 1.5; max-width: 320px; }

/* Coordinator "Mi zona" */
.myzone { border: 1.5px solid #C9D6F0; background: #F3F6FD; border-radius: 20px; padding: 16px; margin-top: 6px; }
.myzone-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.myzone-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--primary); }
.myzone-name { font-size: 19px; font-weight: 800; color: var(--ink); margin-top: 3px; letter-spacing: -.01em; }
.zone-badge { display: flex; align-items: center; gap: 6px; flex: none; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
.zone-badge--green { background: var(--green-bg); color: var(--green-c); }
.zone-badge--amber { background: var(--amber-bg); color: var(--amber-c); }
.dot { width: 9px; height: 9px; border-radius: 50%; }
.dot--green { background: var(--green-dot); } .dot--amber { background: var(--amber-dot); }
.myzone-stats { font-size: 13.5px; font-weight: 600; color: var(--ink2); margin-top: 9px; }
.myzone-wait { display: flex; align-items: center; gap: 9px; margin-top: 11px; padding: 11px 13px; background: var(--amber-bg); border-radius: 13px; font-size: 13.5px; font-weight: 800; color: var(--amber-c); }

.section-label { padding: 16px 2px 2px; font-size: 11.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--ink2); }

.btn-primary { margin-top: 12px; width: 100%; height: 52px; border: none; border-radius: 14px; background: var(--primary); color: #fff; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; text-decoration: none; }
.btn-primary:hover { background: var(--primary-d); }
.btn-ghost { margin-top: 22px; height: 52px; padding: 0 24px; border: 1.5px solid var(--line); border-radius: 14px; background: #fff; color: var(--ink); font-size: 15.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.btn-ghost:hover { background: #F6F4EF; }
</style>
