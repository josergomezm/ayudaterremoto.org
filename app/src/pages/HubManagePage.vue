<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterLink } from 'vue-router'
import { useHubsStore, type InventoryItem, type InventoryMovement, type HubNeed, type NeedUrgency, type NeedCreatePayload } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore, type Responder } from '../stores/admin'
import { useToast } from '../lib/toast'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import InventoryMovementModal from '../components/InventoryMovementModal.vue'
import { formatRelativeTime } from '../lib/date'

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()

const hubId = route.params.id as string
const showMovementModal = ref(false)

const activeTab = ref<'inventory' | 'needs' | 'movements' | 'details' | 'logs' | 'coordinators'>('inventory')

const hub = computed(() => {
  return hubsStore.hubs.find(h => h.id === hubId)
})

// Carga el historial de movimientos en cuanto el centro esté disponible en el store
// (al entrar directo/refrescar, el centro se carga async — esperamos a que exista).
watch(hub, (h) => { if (h && !h.movements) hubsStore.fetchMovements(hubId) }, { immediate: true })

// ── Inventario: toolbar (búsqueda / categoría / orden) ────────────────────
const invSearch = ref('')
const invCategory = ref('')
const invSort = ref<'name' | 'qty'>('name')
const inventoryView = computed(() => {
  const q = invSearch.value.trim().toLowerCase()
  const list = (hub.value?.inventory || []).filter((i) =>
    (!q || i.name.toLowerCase().includes(q)) && (!invCategory.value || i.category === invCategory.value))
  return [...list].sort((a, b) => (invSort.value === 'qty' ? b.quantity - a.quantity : a.name.localeCompare(b.name)))
})
// Acción "Entrada/salida" por fila → abre el modal con el ítem preseleccionado.
const movementPreselect = ref<InventoryItem | null>(null)
function openMovement(item?: InventoryItem) { movementPreselect.value = item ?? null; showMovementModal.value = true }
const rowMenu = ref<string | null>(null)

// ── Necesidades: crear / editar / cerrar (coordinador) ────────────────────
const NEED_CATEGORIES = ['food', 'water', 'medical', 'hygiene', 'shelter', 'clothing', 'tools', 'other'] as const
const hubNeeds = computed<HubNeed[]>(() => hub.value?.needs ?? [])
const openNeedsCount = computed(() => hubNeeds.value.filter((n) => (n.status ?? 'abierta') === 'abierta').length)
const showNeedForm = ref(false)
const editingNeedId = ref<string | null>(null)
const needForm = ref<{ title: string; description: string; category: NeedCreatePayload['category']; quantity: string; unit: string; urgency: NeedUrgency }>({
  title: '', description: '', category: 'food', quantity: '', unit: '', urgency: 'media',
})
function openNeedForm(need?: HubNeed) {
  if (need) {
    editingNeedId.value = need.id
    needForm.value = {
      title: need.title, description: need.description ?? '', category: need.category,
      quantity: need.quantity != null ? String(need.quantity) : '', unit: need.unit ?? '', urgency: need.urgency,
    }
  } else {
    editingNeedId.value = null
    needForm.value = { title: '', description: '', category: 'food', quantity: '', unit: '', urgency: 'media' }
  }
  showNeedForm.value = true
}
function closeNeedForm() { showNeedForm.value = false; editingNeedId.value = null }
async function onSaveNeed() {
  const f = needForm.value
  if (!f.title.trim()) { toast.error(t('needs.needTitle')); return }
  const payload: NeedCreatePayload = {
    title: f.title.trim(),
    description: f.description.trim() || undefined,
    category: f.category,
    quantity: f.quantity ? Number(f.quantity) : undefined,
    unit: f.unit.trim() || undefined,
    urgency: f.urgency,
  }
  const r = editingNeedId.value
    ? await hubsStore.updateNeed(hubId, editingNeedId.value, payload)
    : await hubsStore.createNeed(hubId, payload)
  if (r.ok) { toast.success(t('needs.saved')); closeNeedForm() }
  else toast.error((r as { error?: string }).error || t('common.error'))
}
async function onDeleteNeed(need: HubNeed) {
  if (!window.confirm(t('home.closeConfirm'))) return
  const r = await hubsStore.deleteNeed(hubId, need.id)
  if (r.ok) toast.success(t('needs.deleted'))
  else toast.error((r as { error?: string }).error || t('common.error'))
}

// ── Movimientos: filtro + agrupación por día + resumen semanal ────────────
const mvFilter = ref<'all' | 'entrada' | 'salida'>('all')
const filteredMovements = computed<InventoryMovement[]>(() =>
  (hub.value?.movements || []).filter((m) => mvFilter.value === 'all' || m.type === mvFilter.value))
function dayKey(iso: string): 'today' | 'yesterday' | 'earlier' {
  const t = new Date(iso).getTime()
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t >= startToday) return 'today'
  if (t >= startToday - 86400000) return 'yesterday'
  return 'earlier'
}
const groupedMovements = computed(() => {
  const groups: { key: 'today' | 'yesterday' | 'earlier'; items: InventoryMovement[] }[] = []
  for (const m of filteredMovements.value) {
    const k = dayKey(m.createdAt)
    let g = groups.find((x) => x.key === k)
    if (!g) { g = { key: k, items: [] }; groups.push(g) }
    g.items.push(m)
  }
  return groups
})
const weekCounts = computed(() => {
  const weekAgo = Date.now() - 7 * 86400000
  const recent = (hub.value?.movements || []).filter((m) => new Date(m.createdAt).getTime() >= weekAgo)
  return { in: recent.filter((m) => m.type === 'entrada').length, out: recent.filter((m) => m.type === 'salida').length }
})
function fmtQty(n: number) { return (Math.round(n * 100) / 100).toString() }

const coordinators = computed(() => {
  return (hub.value as any)?.coordinators || []
})

const hasAccess = computed(() => {
  if (!session.ready) return true // Show loader, don't block immediately
  if (admin.isAdmin || session.can('admin')) return true // Organizador+ supervisa todas las zonas
  if (hub.value) {
    if (hub.value.createdBy === session.email) return true
    return coordinators.value.some((c: any) => c.email === session.email)
  }
  return false
})

// Hub Details Form state
const editForm = ref({
  name: '',
  address: '',
  contactName: '',
  contactPhone: '',
  whatsappGroup: '',
  status: 'active' as 'active' | 'closed',
  offersShelter: false,
  shelterCapacity: null as number | null
})

watch(hub, (newHub) => {
  if (newHub) {
    editForm.value = {
      name: newHub.name,
      address: newHub.address,
      contactName: newHub.contactName,
      contactPhone: newHub.contactPhone,
      whatsappGroup: newHub.whatsappGroup || '',
      status: newHub.status,
      offersShelter: newHub.offersShelter || false,
      shelterCapacity: newHub.shelterCapacity !== undefined ? newHub.shelterCapacity : null
    }
  }
}, { immediate: true })

// Add Resource form state
const showAddResourceForm = ref(false)
const addResourceForm = ref({
  name: '',
  category: 'water' as 'water' | 'food' | 'tools' | 'medical' | 'shelter' | 'clothing' | 'hygiene' | 'other',
  quantity: 1,
  unit: '',
  urgency: 'available' as 'available' | 'low' | 'depleted'
})

// Adjust Resource form state
const adjustingItem = ref<InventoryItem | null>(null)
const adjustForm = ref({
  delta: 1,
  action: 'adjust' as 'restock' | 'distribute' | 'adjust',
  note: ''
})

// Add Coordinator state
const newCoordinatorEmail = ref('')
const addingCoordinator = ref(false)
const updatingDetails = ref(false)

const coordinatorUsers = ref<Responder[]>([])
const loadingCoordinatorUsers = ref(false)

async function fetchCoordinatorUsers() {
  loadingCoordinatorUsers.value = true
  const res = await admin.listResponders()
  if (res.ok) {
    coordinatorUsers.value = res.data.responders.filter((u) => u.role === 'coordinator')
  }
  loadingCoordinatorUsers.value = false
}

onMounted(async () => {
  await hubsStore.fetchAll()
  await fetchLogs()
  await fetchCoordinatorUsers()
})

async function fetchLogs() {
  await hubsStore.fetchLogs(hubId)
}

async function onSaveDetails() {
  if (!editForm.value.name.trim() || !editForm.value.address.trim() || !editForm.value.contactName.trim() || !editForm.value.contactPhone.trim()) {
    toast.error(t('common.error'))
    return
  }
  updatingDetails.value = true
  const res = await hubsStore.updateHub(hubId, {
    name: editForm.value.name.trim(),
    address: editForm.value.address.trim(),
    contactName: editForm.value.contactName.trim(),
    contactPhone: editForm.value.contactPhone.trim(),
    whatsappGroup: editForm.value.whatsappGroup.trim() || undefined,
    status: editForm.value.status,
    offersShelter: hub.value?.hubType === 'static' ? editForm.value.offersShelter : false,
    shelterCapacity: (hub.value?.hubType === 'static' && editForm.value.offersShelter) ? (Number(editForm.value.shelterCapacity) || 0) : 0
  })
  updatingDetails.value = false
  if (res.ok) {
    toast.success(t('common.saved'))
    await hubsStore.fetchAll()
  } else {
    toast.error(res.error || t('common.error'))
  }
}

function openAdjustModal(item: InventoryItem) {
  adjustingItem.value = item
  adjustForm.value = {
    delta: 1,
    action: 'adjust',
    note: ''
  }
}

async function onAdjustSubmit() {
  if (!adjustingItem.value) return
  
  let delta = adjustForm.value.delta
  if (adjustForm.value.action === 'distribute') {
    delta = -Math.abs(delta)
  } else if (adjustForm.value.action === 'restock') {
    delta = Math.abs(delta)
  }

  const res = await hubsStore.adjustInventory(hubId, adjustingItem.value.id, {
    delta,
    action: adjustForm.value.action,
    note: adjustForm.value.note.trim() || undefined
  })

  if (res.ok) {
    toast.success(t('common.saved'))
    adjustingItem.value = null
    await hubsStore.fetchAll()
    await fetchLogs()
  } else {
    toast.error(res.error || t('common.error'))
  }
}

async function onAddResource() {
  if (!addResourceForm.value.name.trim() || !addResourceForm.value.unit.trim()) {
    toast.error(t('common.error'))
    return
  }
  const res = await hubsStore.addInventory(hubId, {
    name: addResourceForm.value.name.trim(),
    category: addResourceForm.value.category,
    quantity: addResourceForm.value.quantity,
    unit: addResourceForm.value.unit.trim(),
    urgency: addResourceForm.value.urgency
  })
  if (res.ok) {
    toast.success(t('common.saved'))
    showAddResourceForm.value = false
    addResourceForm.value = {
      name: '',
      category: 'water',
      quantity: 1,
      unit: '',
      urgency: 'available'
    }
    await hubsStore.fetchAll()
  } else {
    toast.error(res.error || t('common.error'))
  }
}

async function onRemoveItem(itemId: string) {
  if (!confirm(t('common.confirm') || '¿Está seguro de eliminar este recurso?')) return
  const res = await hubsStore.removeInventory(hubId, itemId)
  if (res.ok) {
    toast.success(t('common.saved'))
    await hubsStore.fetchAll()
    await fetchLogs()
  } else {
    toast.error(res.error || t('common.error'))
  }
}

async function onAddCoordinator() {
  if (!newCoordinatorEmail.value.trim()) return
  addingCoordinator.value = true
  const res = await hubsStore.addCoordinator(hubId, newCoordinatorEmail.value.trim())
  addingCoordinator.value = false
  if (res.ok) {
    toast.success(t('common.saved'))
    newCoordinatorEmail.value = ''
    await hubsStore.fetchAll()
  } else {
    toast.error(res.error || t('common.error'))
  }
}

async function onRemoveCoordinator(email: string) {
  if (!confirm(t('common.confirm') || `¿Quitar a ${email}?`)) return
  const res = await hubsStore.removeCoordinator(hubId, email)
  if (res.ok) {
    toast.success(t('common.saved'))
    await hubsStore.fetchAll()
  } else {
    toast.error(res.error || t('common.error'))
  }
}
</script>

<template>
  <div class="mx-auto space-y-5 p-4 max-w-4xl">
    <!-- Loading store/session -->
    <div v-if="!session.ready || hubsStore.loading" class="py-10">
      <Loader :label="t('common.loading')" />
    </div>

    <!-- Unauthorized Guard -->
    <div v-else-if="!hasAccess" class="mx-auto max-w-md p-6 text-center space-y-4 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 mt-10">
      <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <MaterialIcon name="gpp_maybe" :size="28" />
      </div>
      <h2 class="text-lg font-bold text-slate-900">{{ t('admin.noAccess') || 'Acceso Denegado' }}</h2>
      <p class="text-sm text-slate-500">{{ t('admin.noAccessBody') || 'No tiene permisos para administrar esta zona.' }}</p>
      <RouterLink to="/hubs" class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 shadow-sm cursor-pointer">
        {{ t('hubs.backToHubs') }}
      </RouterLink>
    </div>

    <!-- Main Dashboard -->
    <div v-else-if="hub" class="space-y-6">
      <header class="space-y-2">
        <RouterLink 
          to="/hubs" 
          class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
        >
          <MaterialIcon name="arrow_back" :size="16" />
          <span>{{ t('hubs.backToHubs') }}</span>
        </RouterLink>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold text-slate-900">{{ hub.name }}</h1>
            <p class="text-sm text-slate-500">{{ hub.address }}</p>
          </div>
          <span 
            class="inline-flex self-start items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="hub.status === 'active' 
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' 
              : 'bg-slate-50 text-slate-600 ring-slate-500/10'"
          >
            {{ hub.status === 'active' ? t('hubs.statusActive') : t('hubs.statusClosed') }}
          </span>
        </div>
      </header>

      <!-- Navigation Tabs -->
      <div class="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button 
          v-for="tab in ['inventory', 'needs', 'movements', 'details', 'logs', 'coordinators']"
          :key="tab"
          @click="activeTab = tab as any"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
          :class="activeTab === tab 
            ? 'border-slate-900 text-slate-900' 
            : 'border-transparent text-slate-500 hover:text-slate-700'"
        >
          <span v-if="tab === 'inventory'">{{ t('hubs.inventory') }}</span>
          <span v-else-if="tab === 'needs'">{{ t('needs.title') }}</span>
          <span v-else-if="tab === 'movements'">{{ t('movements.history') }}</span>
          <span v-else-if="tab === 'details'">{{ t('hubs.hubDetails') }}</span>
          <span v-else-if="tab === 'logs'">{{ t('hubs.activityLog') }}</span>
          <span v-else-if="tab === 'coordinators'">{{ t('hubs.coordinators') }}</span>
        </button>
      </div>

      <!-- Modal de movimiento (lote) — disponible desde cualquier pestaña -->
      <InventoryMovementModal
        v-if="showMovementModal"
        :hub-id="hubId"
        :items="hub?.inventory || []"
        :preselect="movementPreselect"
        @close="showMovementModal = false; movementPreselect = null"
        @saved="hubsStore.fetchMovements(hubId)"
      />

      <!-- Tab Contents -->
      <div class="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-200">
        
        <!-- Tab 1: Inventory Table -->
        <div v-if="activeTab === 'inventory'" class="space-y-5 supply-theme">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.inventory') }}</h2>
            <div class="flex items-center gap-2">
              <button
                @click="openMovement()"
                class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 cursor-pointer shadow-sm"
              >
                <MaterialIcon name="swap_vert" :size="16" />
                {{ t('movements.register') }}
              </button>
              <button
                @click="showAddResourceForm = true"
                class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 cursor-pointer shadow-sm"
              >
                <MaterialIcon name="add" :size="16" />
                {{ t('hubs.addResource') }}
              </button>
            </div>
          </div>

          <!-- Resumen + toolbar (rediseño) -->
          <div class="flex flex-wrap items-center gap-2.5">
            <div class="px-4 py-3 rounded-2xl border border-[#E7E2D9] bg-[#FCFBF9] min-w-[110px]">
              <div class="text-2xl font-extrabold text-[#211F1B] leading-none">{{ hub.inventory.length }}</div>
              <div class="text-xs font-semibold text-[#6F685C] mt-1.5">{{ t('movements.invResources') }}</div>
            </div>
            <div class="px-4 py-3 rounded-2xl border border-[#E7E2D9] bg-[#FCFBF9]">
              <div class="text-sm font-extrabold text-[#211F1B] leading-none flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#16A866]"></span> {{ formatRelativeTime(hub.updatedAt, locale) }}</div>
              <div class="text-xs font-semibold text-[#6F685C] mt-2">{{ t('hubs.lastUpdate') }}</div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <div class="flex-1 min-w-[180px] flex items-center gap-2 h-11 px-3 bg-[#F7F5F1] border border-[#E7E2D9] rounded-xl">
              <MaterialIcon name="search" :size="19" class="text-[#938B7D]" />
              <input v-model="invSearch" :placeholder="t('movements.invSearch')" class="flex-1 bg-transparent outline-none text-sm text-[#211F1B]" />
            </div>
            <select v-model="invCategory" class="h-11 px-3 border border-[#E7E2D9] bg-white rounded-xl text-sm font-bold text-[#211F1B] cursor-pointer">
              <option value="">{{ t('hubs.category') }}</option>
              <option v-for="c in ['water','food','medical','tools','shelter','clothing','hygiene','other']" :key="c" :value="c">{{ t('hubs.categories.' + c) }}</option>
            </select>
            <select v-model="invSort" class="h-11 px-3 border border-[#E7E2D9] bg-white rounded-xl text-sm font-bold text-[#211F1B] cursor-pointer">
              <option value="name">{{ t('movements.invSortName') }}</option>
              <option value="qty">{{ t('movements.invSortQty') }}</option>
            </select>
          </div>

          <!-- Add Resource Form -->
          <div v-if="showAddResourceForm" class="p-4 bg-slate-50 rounded-xl ring-1 ring-slate-200 space-y-4">
            <h3 class="text-sm font-bold text-slate-800">{{ t('hubs.addResource') }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-600">{{ t('hubs.resourceName') }}</label>
                <input 
                  v-model="addResourceForm.name"
                  type="text"
                  required
                  :placeholder="t('hubs.resourceNamePlaceholder')"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-600">{{ t('hubs.category') }}</label>
                <select 
                  v-model="addResourceForm.category"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="water">{{ t('hubs.categories.water') }}</option>
                  <option value="food">{{ t('hubs.categories.food') }}</option>
                  <option value="tools">{{ t('hubs.categories.tools') }}</option>
                  <option value="medical">{{ t('hubs.categories.medical') }}</option>
                  <option value="shelter">{{ t('hubs.categories.shelter') }}</option>
                  <option value="clothing">{{ t('hubs.categories.clothing') }}</option>
                  <option value="hygiene">{{ t('hubs.categories.hygiene') }}</option>
                  <option value="other">{{ t('hubs.categories.other') }}</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-600">{{ t('hubs.quantity') }}</label>
                <input 
                  v-model.number="addResourceForm.quantity"
                  type="number"
                  min="0"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-600">{{ t('hubs.unit') }}</label>
                <input 
                  v-model="addResourceForm.unit"
                  type="text"
                  required
                  :placeholder="t('hubs.unitPlaceholder')"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-600">{{ t('hubs.category') }} (Urgencia)</label>
                <select 
                  v-model="addResourceForm.urgency"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="available">{{ t('hubs.urgency.available') }}</option>
                  <option value="low">{{ t('hubs.urgency.low') }}</option>
                  <option value="depleted">{{ t('hubs.urgency.depleted') }}</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                @click="showAddResourceForm = false"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                @click="onAddResource"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 cursor-pointer"
              >
                {{ t('hubs.save') }}
              </button>
            </div>
          </div>

          <!-- Inventory table (rediseño · Centro Detalle) -->
          <div v-if="inventoryView.length === 0" class="text-[#6F685C] italic text-sm py-6">
            {{ invSearch || invCategory ? t('home.emptyTitle') : t('hubs.emptyInventory') }}
          </div>
          <div v-else>
            <div class="hidden sm:grid grid-cols-[2.4fr_2fr_1.6fr_1.4fr] gap-3.5 px-1 pb-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#938B7D] border-b border-[#EFEBE3]">
              <div>{{ t('hubs.resourceName') }}</div><div>{{ t('hubs.category') }}</div><div>{{ t('hubs.quantity') }}</div><div class="text-right">{{ t('movements.invActions') }}</div>
            </div>
            <div
              v-for="item in inventoryView" :key="item.id"
              class="grid grid-cols-[1fr_auto] sm:grid-cols-[2.4fr_2fr_1.6fr_1.4fr] gap-x-3.5 gap-y-1.5 items-center py-3.5 px-1 border-b border-[#EFEBE3]"
            >
              <div class="min-w-0">
                <div class="text-base font-extrabold text-[#211F1B] tracking-tight">{{ item.name }}</div>
                <div class="text-xs font-semibold text-[#938B7D]">{{ t('movements.invUpdatedAt', { time: formatRelativeTime(item.updatedAt, locale) }) }}</div>
              </div>
              <div class="hidden sm:block text-sm font-semibold text-[#6F685C]">{{ t('hubs.categories.' + item.category) }}</div>
              <div class="text-right sm:text-left text-lg font-extrabold text-[#211F1B]">{{ fmtQty(item.quantity) }} {{ item.unit }}</div>
              <div class="col-span-2 sm:col-span-1 flex sm:justify-end gap-1.5 relative">
                <button class="w-9 h-9 border border-[#E7E2D9] rounded-[10px] bg-white flex items-center justify-center hover:bg-[#F6F4EF] cursor-pointer" :title="t('hubs.adjust')" @click="openAdjustModal(item)">
                  <MaterialIcon name="tune" :size="19" class="text-[#6F685C]" />
                </button>
                <button class="w-9 h-9 border border-[#E7E2D9] rounded-[10px] bg-white flex items-center justify-center hover:bg-[#F6F4EF] cursor-pointer" :title="t('movements.register')" @click="openMovement(item)">
                  <MaterialIcon name="swap_vert" :size="19" class="text-[#6F685C]" />
                </button>
                <button class="w-9 h-9 border border-[#E7E2D9] rounded-[10px] bg-white flex items-center justify-center hover:bg-[#F6F4EF] cursor-pointer" :title="t('movements.invMore')" @click="rowMenu = rowMenu === item.id ? null : item.id">
                  <MaterialIcon name="more_horiz" :size="19" class="text-[#6F685C]" />
                </button>
                <div v-if="rowMenu === item.id" class="absolute right-0 top-10 z-10 bg-white border border-[#E7E2D9] rounded-xl shadow-lg py-1 min-w-[150px]">
                  <button class="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold text-[#B42318] hover:bg-red-50 cursor-pointer" @click="rowMenu = null; onRemoveItem(item.id)">
                    <MaterialIcon name="delete" :size="18" /> {{ t('hubs.remove') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Movimientos (ledger por lote · rediseño) -->
        <div v-else-if="activeTab === 'movements'" class="space-y-4 supply-theme">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex bg-[#EFEBE3] rounded-[11px] p-1 gap-0.5">
              <button
                v-for="f in (['all', 'entrada', 'salida'] as const)" :key="f"
                @click="mvFilter = f"
                class="px-4 py-1.5 rounded-lg text-[13px] font-bold transition"
                :class="mvFilter === f ? 'bg-white shadow-sm text-[#211F1B]' : 'text-[#6F685C]'"
              >{{ f === 'all' ? t('movements.filterAll') : f === 'entrada' ? t('movements.filterIn') : t('movements.filterOut') }}</button>
            </div>
            <div class="flex items-center gap-3">
              <div class="hidden sm:block text-xs font-semibold text-[#6F685C]">{{ t('movements.weekSummary', { in: weekCounts.in, out: weekCounts.out }) }}</div>
              <button @click="openMovement()" class="h-10 px-4 rounded-xl bg-[#2350C9] text-white text-sm font-extrabold flex items-center gap-1.5 hover:bg-[#1B3FA3] cursor-pointer">
                <MaterialIcon name="swap_vert" :size="18" /> {{ t('movements.register') }}
              </button>
            </div>
          </div>

          <div v-if="filteredMovements.length === 0" class="py-10 text-center text-sm italic text-[#6F685C]">{{ t('movements.empty') }}</div>

          <div v-else class="space-y-4">
            <div v-for="g in groupedMovements" :key="g.key">
              <div class="text-[11px] font-extrabold uppercase tracking-wide text-[#938B7D] mb-3">
                {{ g.key === 'today' ? t('movements.today') : g.key === 'yesterday' ? t('movements.yesterday') : t('movements.earlier') }}
              </div>
              <div class="space-y-3.5">
                <div v-for="mv in g.items" :key="mv.id" class="flex gap-3.5">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-none" :class="mv.type === 'entrada' ? 'bg-[#E9F6EE]' : 'bg-[#FBF1DF]'">
                    <MaterialIcon :name="mv.type === 'entrada' ? 'south' : 'north'" :size="21" :class="mv.type === 'entrada' ? 'text-[#15794B]' : 'text-[#9A5808]'" />
                  </div>
                  <div class="flex-1 min-w-0 border border-[#E7E2D9] rounded-2xl p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-2 flex-wrap min-w-0">
                        <span class="text-[11px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md" :class="mv.type === 'entrada' ? 'text-[#15794B] bg-[#E9F6EE]' : 'text-[#9A5808] bg-[#FBF1DF]'">
                          {{ mv.type === 'entrada' ? t('movements.entrada') : t('movements.salida') }}
                        </span>
                        <span class="text-base font-extrabold text-[#211F1B] tracking-tight truncate">{{ mv.reason }}</span>
                      </div>
                      <span class="text-xs font-semibold text-[#938B7D] whitespace-nowrap">{{ formatRelativeTime(mv.createdAt, locale) }}</span>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-3">
                      <div
                        v-for="(ln, j) in mv.lines" :key="j"
                        class="flex items-center gap-2 px-3 py-2 rounded-[10px] border"
                        :class="mv.type === 'entrada' ? 'bg-[#F4FAF6] border-[#D9EEE1]' : 'bg-[#FBF6F4] border-[#F0DDD7]'"
                      >
                        <span class="text-[13.5px] font-bold text-[#211F1B]">{{ ln.itemName }}</span>
                        <span class="text-[13.5px] font-extrabold" :class="mv.type === 'entrada' ? 'text-[#15794B]' : 'text-[#B42318]'">{{ mv.type === 'entrada' ? '+' : '−' }}{{ fmtQty(ln.quantity) }} {{ ln.unit }}</span>
                        <span v-if="ln.resultingQty !== undefined" class="text-xs font-semibold text-[#938B7D]">→ {{ fmtQty(ln.resultingQty) }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-4 mt-3 pt-3 border-t border-[#EFEBE3] text-xs font-semibold text-[#6F685C] flex-wrap">
                      <span class="flex items-center gap-1.5"><MaterialIcon name="person" :size="16" class="text-[#938B7D]" /> {{ mv.actorName }}</span>
                      <span v-if="mv.note" class="flex items-center gap-1.5"><MaterialIcon name="sticky_note_2" :size="16" class="text-[#938B7D]" /> {{ mv.note }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Hub Details Form -->
        <!-- ── Pestaña Necesidades (manual, desacoplada del inventario) ── -->
        <div v-else-if="activeTab === 'needs'" class="space-y-4 supply-theme">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold" style="color: var(--ink)">{{ t('needs.manageTitle') }}</h3>
              <p class="text-sm" style="color: var(--ink2)">{{ t('needs.openCount', { n: openNeedsCount }) }}</p>
            </div>
            <button
              class="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
              @click="openNeedForm()"
            >
              <MaterialIcon name="add" :size="18" /> {{ t('needs.add') }}
            </button>
          </div>

          <!-- Form crear / editar -->
          <div v-if="showNeedForm" class="rounded-2xl border p-4 space-y-3 bg-white" style="border-color: var(--line)">
            <label class="block">
              <span class="text-xs font-bold" style="color: var(--ink2)">{{ t('needs.formTitle') }}</span>
              <input v-model="needForm.title" :placeholder="t('needs.formTitlePlaceholder')" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style="border-color: var(--line)" />
            </label>
            <label class="block">
              <span class="text-xs font-bold" style="color: var(--ink2)">{{ t('needs.formDescription') }}</span>
              <textarea v-model="needForm.description" rows="2" :placeholder="t('needs.formDescriptionPlaceholder')" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style="border-color: var(--line)"></textarea>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-xs font-bold" style="color: var(--ink2)">{{ t('needs.formCategory') }}</span>
                <select v-model="needForm.category" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" style="border-color: var(--line)">
                  <option v-for="c in NEED_CATEGORIES" :key="c" :value="c">{{ t('hubs.categories.' + c) }}</option>
                </select>
              </label>
              <label class="block">
                <span class="text-xs font-bold" style="color: var(--ink2)">{{ t('needs.formUrgency') }}</span>
                <select v-model="needForm.urgency" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white" style="border-color: var(--line)">
                  <option value="alta">{{ t('needs.urgency.alta') }}</option>
                  <option value="media">{{ t('needs.urgency.media') }}</option>
                  <option value="baja">{{ t('needs.urgency.baja') }}</option>
                </select>
              </label>
              <label class="block">
                <span class="text-xs font-bold" style="color: var(--ink2)">{{ t('needs.formQuantity') }}</span>
                <input v-model="needForm.quantity" type="number" min="0" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style="border-color: var(--line)" />
              </label>
              <label class="block">
                <span class="text-xs font-bold" style="color: var(--ink2)">{{ t('needs.formUnit') }}</span>
                <input v-model="needForm.unit" :placeholder="t('needs.formUnitPlaceholder')" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style="border-color: var(--line)" />
              </label>
            </div>
            <div class="flex gap-2 pt-1">
              <button class="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90" @click="onSaveNeed">{{ t('needs.save') }}</button>
              <button class="rounded-xl border px-4 py-2.5 text-sm font-bold" style="border-color: var(--line); color: var(--ink)" @click="closeNeedForm">{{ t('needs.cancel') }}</button>
            </div>
          </div>

          <!-- Lista de necesidades -->
          <div v-if="hubNeeds.length" class="space-y-2">
            <div v-for="need in hubNeeds" :key="need.id" class="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3" style="border-color: var(--line)">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase"
                    :class="{
                      'bg-red-100 text-red-700': need.urgency === 'alta',
                      'bg-amber-100 text-amber-700': need.urgency === 'media',
                      'bg-emerald-100 text-emerald-700': need.urgency === 'baja'
                    }"
                  >{{ t('needs.urgency.' + need.urgency) }}</span>
                  <span class="font-bold truncate" style="color: var(--ink)">{{ need.title }}</span>
                </div>
                <div class="text-xs mt-0.5" style="color: var(--ink2)">
                  <span v-if="need.quantity != null">{{ need.quantity }} {{ need.unit }} · </span>
                  <span>{{ t('hubs.needStatus.' + (need.status ?? 'abierta')) }}</span>
                </div>
              </div>
              <div class="flex gap-1 shrink-0" style="color: var(--ink2)">
                <button class="rounded-lg p-2 hover:bg-[var(--line2)]" :title="t('needs.edit')" @click="openNeedForm(need)"><MaterialIcon name="edit" :size="18" /></button>
                <button class="rounded-lg p-2 hover:bg-[var(--line2)]" @click="onDeleteNeed(need)"><MaterialIcon name="delete" :size="18" /></button>
              </div>
            </div>
          </div>
          <div v-else class="text-sm py-6 text-center" style="color: var(--ink2)">{{ t('needs.emptyManage') }}</div>
        </div>

        <div v-else-if="activeTab === 'details'" class="space-y-6">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.hubDetails') }}</h2>
          
          <form @submit.prevent="onSaveDetails" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Name -->
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-slate-700">{{ t('hubs.hubName') }}</label>
                <input 
                  v-model="editForm.name"
                  type="text"
                  required
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <!-- Contact Name -->
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-slate-700">{{ t('hubs.contactName') }}</label>
                <input 
                  v-model="editForm.contactName"
                  type="text"
                  required
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <!-- Contact Phone -->
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-slate-700">{{ t('hubs.contactPhone') }}</label>
                <input 
                  v-model="editForm.contactPhone"
                  type="text"
                  required
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <!-- Address -->
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-slate-700">{{ t('hubs.address') }}</label>
                <input 
                  v-model="editForm.address"
                  type="text"
                  required
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <!-- WhatsApp Group -->
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-slate-700">{{ t('hubs.whatsappGroup') }}</label>
                <input 
                  v-model="editForm.whatsappGroup"
                  type="url"
                  :placeholder="t('hubs.whatsappGroupPlaceholder')"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <!-- Shelter section (only for static hubs) -->
            <div v-if="hub?.hubType === 'static'" class="space-y-4 pt-3 border-t border-slate-100 mt-2">
              <div class="flex items-center gap-2">
                <input 
                  v-model="editForm.offersShelter"
                  type="checkbox" 
                  id="edit-offers-shelter" 
                  class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label for="edit-offers-shelter" class="text-sm font-semibold text-slate-700 cursor-pointer">
                  Ofrece refugio / lugar para dormir
                </label>
              </div>

              <div v-if="editForm.offersShelter" class="space-y-1.5 max-w-xs">
                <label class="text-sm font-semibold text-slate-700">Plazas / Camas disponibles</label>
                <input 
                  v-model.number="editForm.shelterCapacity"
                  type="number" 
                  min="0"
                  required
                  placeholder="ej. 15"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <!-- Status Toggle Card -->
            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-xl ring-1 ring-slate-100 mt-4">
              <div>
                <span class="text-sm font-semibold text-slate-800">Estado del Centro: </span>
                <span 
                  class="text-sm font-bold capitalize" 
                  :class="editForm.status === 'active' ? 'text-emerald-600' : 'text-slate-500'"
                >
                  {{ editForm.status === 'active' ? t('hubs.statusActive') : t('hubs.statusClosed') }}
                </span>
              </div>
              <button 
                type="button"
                @click="editForm.status = editForm.status === 'active' ? 'closed' : 'active'"
                class="px-4 py-2 text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition"
                :class="editForm.status === 'active' 
                  ? 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-600/10' 
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-600/10'"
              >
                {{ editForm.status === 'active' ? t('hubs.closeHub') : t('hubs.reopenHub') }}
              </button>
            </div>

            <!-- Submit Button -->
            <div class="flex justify-end pt-4 border-t border-slate-100">
              <button 
                type="submit"
                :disabled="updatingDetails"
                class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                <Loader v-if="updatingDetails" :size="16" class="mr-1" />
                <MaterialIcon v-else name="save" :size="18" />
                {{ updatingDetails ? t('hubs.saving') : t('hubs.updateDetails') }}
              </button>
            </div>
          </form>
        </div>

        <!-- Tab 3: Activity Log Timeline -->
        <div v-else-if="activeTab === 'logs'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.activityLog') }}</h2>
            <button 
              @click="fetchLogs"
              class="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Actualizar registro"
            >
              <MaterialIcon name="refresh" :size="20" />
            </button>
          </div>

          <div v-if="!hub?.recentLogs || hub.recentLogs.length === 0" class="text-slate-500 italic text-sm py-4">
            {{ t('hubs.emptyLog') }}
          </div>
          <div v-else class="flow-root py-2">
            <ul role="list" class="-mb-8">
              <li v-for="(log, logIdx) in hub.recentLogs" :key="log.id">
                <div class="relative pb-8">
                  <span v-if="logIdx !== hub.recentLogs.length - 1" class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true"></span>
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
                        <p class="text-[10px] text-slate-400 mt-1.5">
                          {{ log.actorEmail }}
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

        <!-- Tab 4: Coordinators -->
        <div v-else-if="activeTab === 'coordinators'" class="space-y-6">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.coordinators') }}</h2>
          
          <div class="space-y-3">
            <!-- Creator (Always non-removable) -->
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
              <div>
                <p class="text-sm font-semibold text-slate-800">{{ hub.createdBy }}</p>
              </div>
              <span class="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                {{ t('hubs.creator') }}
              </span>
            </div>

            <!-- Co-coordinators -->
            <div v-for="coord in coordinators" :key="coord.email" class="flex items-center justify-between p-3 rounded-xl bg-white ring-1 ring-slate-200">
              <div>
                <p class="text-sm font-medium text-slate-800">{{ coord.email }}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">
                  {{ t('hubs.lastUpdate') }}: {{ formatRelativeTime(coord.addedAt, locale) }}
                </p>
              </div>
              <button 
                v-if="coord.email !== hub.createdBy"
                @click="onRemoveCoordinator(coord.email)"
                class="inline-flex items-center gap-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
              >
                <MaterialIcon name="delete" :size="14" />
                {{ t('hubs.removeCoordinator') }}
              </button>
            </div>
          </div>

          <!-- Add Coordinator Form -->
          <form @submit.prevent="onAddCoordinator" class="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-end">
            <div class="flex-1 space-y-1.5">
              <label class="text-sm font-semibold text-slate-700">{{ t('hubs.addCoordinator') }}</label>
              <select 
                v-model="newCoordinatorEmail"
                required
                class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              >
                <option value="" disabled>{{ t('hubs.coordinatorEmailPlaceholder') }}</option>
                <option 
                  v-for="u in coordinatorUsers" 
                  :key="u.email" 
                  :value="u.email"
                >
                  {{ u.email }} ({{ t('roles.' + u.role) }})
                </option>
              </select>
            </div>
            <button 
              type="submit"
              :disabled="addingCoordinator"
              class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50 cursor-pointer w-full sm:w-auto"
            >
              <MaterialIcon name="person_add" :size="18" />
              <span>{{ t('hubs.addCoordinator') }}</span>
            </button>
          </form>
        </div>

      </div>
    </div>

    <!-- Adjust Item Modal -->
    <div v-if="adjustingItem" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 space-y-4">
        <h3 class="text-lg font-bold text-slate-900">{{ t('hubs.adjustQuantity') }}</h3>
        <p class="text-sm text-slate-500 font-semibold">{{ adjustingItem.name }} ({{ adjustingItem.quantity }} {{ adjustingItem.unit }} actuales)</p>
        
        <form @submit.prevent="onAdjustSubmit" class="space-y-4 pt-2">
          <!-- Action select -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-500">{{ t('hubs.category') }} (Acción)</label>
            <select 
              v-model="adjustForm.action"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="adjust">{{ t('hubs.adjustAction') }}</option>
              <option value="restock">{{ t('hubs.restock') }}</option>
              <option value="distribute">{{ t('hubs.distribute') }}</option>
            </select>
          </div>

          <!-- Delta input -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-500">{{ t('hubs.delta') }}</label>
            <input 
              v-model.number="adjustForm.delta"
              type="number"
              required
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <!-- Optional Note -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-500">Nota</label>
            <textarea 
              v-model="adjustForm.note"
              rows="2"
              :placeholder="t('hubs.notePlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            ></textarea>
          </div>

          <!-- Buttons -->
          <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              @click="adjustingItem = null"
              class="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              class="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 cursor-pointer"
            >
              {{ t('hubs.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
