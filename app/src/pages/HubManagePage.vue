<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterLink } from 'vue-router'
import { useHubsStore, type InventoryItem } from '../stores/hubs'
import { useSessionStore } from '../stores/session'
import { useAdminStore, type AdminUser } from '../stores/admin'
import { useToast } from '../lib/toast'
import Loader from '../components/Loader.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import { formatRelativeTime } from '../lib/date'

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const hubsStore = useHubsStore()
const session = useSessionStore()
const admin = useAdminStore()

const hubId = route.params.id as string

const activeTab = ref<'inventory' | 'details' | 'logs' | 'coordinators'>('inventory')

const hub = computed(() => {
  return hubsStore.hubs.find(h => h.id === hubId)
})

const coordinators = computed(() => {
  return (hub.value as any)?.coordinators || []
})

const hasAccess = computed(() => {
  if (!session.ready) return true // Show loader, don't block immediately
  if (session.can('command') || admin.isAdmin) return true
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
  status: 'active' as 'active' | 'closed'
})

watch(hub, (newHub) => {
  if (newHub) {
    editForm.value = {
      name: newHub.name,
      address: newHub.address,
      contactName: newHub.contactName,
      contactPhone: newHub.contactPhone,
      whatsappGroup: newHub.whatsappGroup || '',
      status: newHub.status
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

const adminUsers = ref<AdminUser[]>([])
const loadingAdminUsers = ref(false)

async function fetchAdminUsers() {
  loadingAdminUsers.value = true
  const res = await admin.listAdmins()
  if (res.ok) {
    adminUsers.value = res.data.users
  }
  loadingAdminUsers.value = false
}

onMounted(async () => {
  await hubsStore.fetchAll()
  await fetchLogs()
  await fetchAdminUsers()
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
    status: editForm.value.status
  })
  updatingDetails.value = false
  if (res.ok) {
    toast.success(t('common.saved'))
    await hubsStore.fetchAll()
  } else {
    toast.error(res.error || t('common.error'))
  }
}

async function quickAdjust(itemId: string, delta: number) {
  const item = hub.value?.inventory.find(i => i.id === itemId)
  if (!item) return
  if (item.quantity + delta < 0) return
  
  const res = await hubsStore.adjustInventory(hubId, itemId, {
    delta,
    action: delta > 0 ? 'restock' : 'distribute'
  })
  if (res.ok) {
    toast.success(t('common.saved'))
    await hubsStore.fetchAll()
    await fetchLogs()
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
      <p class="text-sm text-slate-500">{{ t('admin.noAccessBody') || 'No tiene permisos para administrar este centro de acopio.' }}</p>
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
          v-for="tab in ['inventory', 'details', 'logs', 'coordinators']" 
          :key="tab"
          @click="activeTab = tab as any"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
          :class="activeTab === tab 
            ? 'border-slate-900 text-slate-900' 
            : 'border-transparent text-slate-500 hover:text-slate-700'"
        >
          <span v-if="tab === 'inventory'">{{ t('hubs.inventory') }}</span>
          <span v-else-if="tab === 'details'">{{ t('hubs.hubDetails') }}</span>
          <span v-else-if="tab === 'logs'">{{ t('hubs.activityLog') }}</span>
          <span v-else-if="tab === 'coordinators'">{{ t('hubs.coordinators') }}</span>
        </button>
      </div>

      <!-- Tab Contents -->
      <div class="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-200">
        
        <!-- Tab 1: Inventory Table -->
        <div v-if="activeTab === 'inventory'" class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ t('hubs.inventory') }}</h2>
            <button 
              @click="showAddResourceForm = true"
              class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 cursor-pointer shadow-sm"
            >
              <MaterialIcon name="add" :size="16" />
              {{ t('hubs.addResource') }}
            </button>
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

          <!-- Inventory List -->
          <div v-if="hub.inventory.length === 0" class="text-slate-500 italic text-sm">
            {{ t('hubs.emptyInventory') }}
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{{ t('hubs.resourceName') }}</th>
                  <th scope="col" class="px-4 py-3 class text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{{ t('hubs.category') }}</th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{{ t('hubs.quantity') }}</th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Urgencia</th>
                  <th scope="col" class="relative px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 bg-white">
                <tr v-for="item in hub.inventory" :key="item.id">
                  <td class="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900">{{ item.name }}</td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm text-slate-500">{{ t('hubs.categories.' + item.category) }}</td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm text-slate-900">
                    <div class="flex items-center gap-2">
                      <button 
                        @click="quickAdjust(item.id, -1)"
                        class="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer disabled:opacity-50"
                        :disabled="item.quantity <= 0"
                      >
                        <MaterialIcon name="remove" :size="14" />
                      </button>
                      <span class="font-semibold w-12 text-center">{{ item.quantity }} {{ item.unit }}</span>
                      <button 
                        @click="quickAdjust(item.id, 1)"
                        class="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <MaterialIcon name="add" :size="14" />
                      </button>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm">
                    <span 
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                      :class="{
                        'bg-emerald-50 text-emerald-700 ring-emerald-600/10': item.urgency === 'available',
                        'bg-amber-50 text-amber-700 ring-amber-600/10': item.urgency === 'low',
                        'bg-red-50 text-red-700 ring-red-600/10': item.urgency === 'depleted'
                      }"
                    >
                      {{ t('hubs.urgency.' + item.urgency) }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right text-sm font-medium space-x-2">
                    <button 
                      @click="openAdjustModal(item)"
                      class="inline-flex items-center gap-0.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 text-xs font-semibold cursor-pointer"
                    >
                      <MaterialIcon name="tune" :size="12" />
                      <span>{{ t('hubs.adjust') }}</span>
                    </button>
                    <button 
                      @click="onRemoveItem(item.id)"
                      class="inline-flex items-center gap-0.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 text-xs font-semibold cursor-pointer"
                    >
                      <MaterialIcon name="delete" :size="12" />
                      <span>{{ t('hubs.remove') }}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Hub Details Form -->
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
                  v-for="u in adminUsers" 
                  :key="u.email" 
                  :value="u.email"
                >
                  {{ u.email }} ({{ u.role === 'command' ? 'Comando' : 'Autoridad' }})
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
