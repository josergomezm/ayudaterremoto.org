<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore, type AuditEntry, type AuditLogEntry, type AdminUser, type AccessRequest, type ResponderRequest, type Responder, type AnnouncementCategory, type Announcement } from '../stores/admin'
import { useToast } from '../lib/toast'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import Loader from '../components/Loader.vue'

const { t } = useI18n()
const toast = useToast()
const admin = useAdminStore()

const audit = ref<AuditEntry[]>([])
const activity = ref<AuditLogEntry[]>([])
const admins = ref<AdminUser[]>([])
const requests = ref<AccessRequest[]>([])
const reqRole = ref<Record<string, AdminUser['role']>>({})
const newEmail = ref('')
const newRole = ref<AdminUser['role']>('authority')
const cat = ref<AnnouncementCategory>('logistics')
const msg = ref('')
const sent = ref(false)
const alerts = ref<Announcement[]>([])
const categories: AnnouncementCategory[] = ['urgent', 'logistics', 'correction']

// Non-admin self-service request state
const requestNote = ref('')
const requestPhone = ref('')
const requestStatus = ref<string | null>(null)
const requestSent = ref(false)

// Responder approval and roster state
const responderRequests = ref<ResponderRequest[]>([])
const responders = ref<Responder[]>([])
const searchQuery = ref('')

const filteredResponders = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return responders.value
  return responders.value.filter(r =>
    (r.name && r.name.toLowerCase().includes(q)) ||
    r.email.toLowerCase().includes(q)
  )
})

// Tabbed interface state
const activeTab = ref('')

interface Tab {
  id: string
  label: string
  icon: string
  role?: 'command' | 'authority'
}

const tabs = computed<Tab[]>(() => {
  const list: Tab[] = [
    { id: 'responder-requests', label: t('admin.tabResponderRequests'), icon: 'person_add', role: 'authority' },
    { id: 'responders-roster', label: t('admin.tabRespondersRoster'), icon: 'group', role: 'authority' },
  ]
  if (admin.isCommand) {
    list.unshift({ id: 'coordinator-requests', label: t('admin.tabCoordinatorRequests'), icon: 'admin_panel_settings', role: 'command' })
    list.push(
      { id: 'coordinators-manage', label: t('admin.tabCoordinatorsManage'), icon: 'shield', role: 'command' },
      { id: 'announcements', label: t('admin.tabAnnouncements'), icon: 'campaign', role: 'command' },
      { id: 'audit-log', label: t('admin.tabAuditLog'), icon: 'receipt_long', role: 'command' }
    )
  }
  return list
})

watch(tabs, (newTabs) => {
  if (newTabs.length > 0 && (!activeTab.value || !newTabs.some(t => t.id === activeTab.value))) {
    activeTab.value = newTabs[0].id
  }
}, { immediate: true })

async function loadTabSpecificData(tab: string) {
  if (tab === 'responder-requests') {
    const res = await admin.listResponderRequests()
    if (res.ok) responderRequests.value = res.data.requests
  } else if (tab === 'responders-roster') {
    const res = await admin.listResponders()
    if (res.ok) responders.value = res.data.responders
  } else if (tab === 'coordinator-requests') {
    const rq = await admin.listRequests()
    if (rq.ok) {
      requests.value = rq.data.requests
      for (const x of requests.value) if (!reqRole.value[x.email]) reqRole.value[x.email] = 'authority'
    }
  } else if (tab === 'coordinators-manage') {
    const u = await admin.listAdmins()
    if (u.ok) admins.value = u.data.users
  } else if (tab === 'announcements') {
    const an = await admin.listAnnouncements()
    if (an.ok) alerts.value = an.data.announcements
  } else if (tab === 'audit-log') {
    const act = await admin.fetchActivity()
    if (act.ok) activity.value = act.data.entries
    const a = await admin.fetchAudit()
    if (a.ok) audit.value = a.data.entries
  }
}

watch(activeTab, (tab) => {
  if (tab) {
    loadTabSpecificData(tab)
  }
})

// When signed in but not an admin, surface any existing pending request.
watch(() => [admin.ready, !!admin.user, admin.isAdmin], async () => {
  if (admin.ready && admin.user && !admin.isAdmin) {
    const r = await admin.myRequest()
    requestStatus.value = r.ok ? r.data.status : null
  }
}, { immediate: true })

async function signIn() {
  try {
    await admin.signIn()
    if (admin.user && !admin.isAdmin) toast.info(t('admin.noAccessBody'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('common.error'))
  }
}

async function submitRequest() {
  if (requestPhone.value.trim().length < 5) return
  const r = await admin.requestAccess(requestPhone.value, requestNote.value)
  if (r.ok) { requestSent.value = true; requestStatus.value = 'pending'; toast.success(t('admin.requestPending')) }
  else toast.error(r.error || t('common.error'))
}

// Coordinator approvals
async function approve(email: string) {
  const r = await admin.approveRequest(email, reqRole.value[email] ?? 'authority')
  if (r.ok) { await loadTabSpecificData('coordinator-requests'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function deny(email: string) {
  const r = await admin.denyRequest(email)
  if (r.ok) { await loadTabSpecificData('coordinator-requests'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}

// Responder approvals
async function approveResponder(email: string) {
  const r = await admin.approveResponderRequest(email)
  if (r.ok) { await loadTabSpecificData('responder-requests'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function denyResponder(email: string) {
  const r = await admin.denyResponderRequest(email)
  if (r.ok) { await loadTabSpecificData('responder-requests'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function revokeResponder(email: string) {
  if (!confirm(t('admin.removeResponderConfirm'))) return
  const r = await admin.removeResponder(email)
  if (r.ok) { await loadTabSpecificData('responders-roster'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}


async function addAdmin() {
  if (!newEmail.value) return
  const r = await admin.setAdmin(newEmail.value, newRole.value)
  if (r.ok) { newEmail.value = ''; await loadTabSpecificData('coordinators-manage'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function removeAdmin(email: string) {
  const r = await admin.removeAdmin(email)
  if (r.ok) { await loadTabSpecificData('coordinators-manage'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function broadcast() {
  if (!msg.value) return
  const r = await admin.broadcast(cat.value, msg.value)
  if (r.ok) { sent.value = true; msg.value = ''; await loadTabSpecificData('announcements'); toast.success(t('admin.broadcastSent')) }
  else toast.error(r.error || t('common.error'))
}
async function removeAlert(id: string) {
  const r = await admin.deleteAnnouncement(id)
  if (r.ok) { await loadTabSpecificData('announcements'); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 p-4">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ t('admin.title') }}</h1>
        <p class="text-sm text-slate-600">{{ t('admin.subtitle') }}</p>
      </div>
      <div v-if="admin.ready && admin.user && admin.isAdmin" class="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl ring-1 ring-slate-200">
        <div class="text-xs text-slate-700">
          <span class="font-semibold block truncate max-w-[200px]" :title="admin.user?.email || ''">{{ admin.user?.email }}</span>
          <span class="rounded bg-indigo-50 px-1 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">{{ t('roles.' + admin.role) }}</span>
        </div>
        <button class="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors" @click="admin.signOut()">
          {{ t('admin.signOut') }}
        </button>
      </div>
    </header>

    <!-- Loading auth state -->
    <Loader v-if="!admin.ready" :label="t('common.loading')" class="py-12" />

    <!-- Not signed in -->
    <div v-else-if="!admin.user" class="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200 max-w-md mx-auto space-y-4">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <MaterialIcon name="admin_panel_settings" :size="28" />
      </div>
      <p class="text-sm text-slate-600">Inicie sesión con su cuenta autorizada de Google para entrar al portal de administración.</p>
      <BaseButton block @click="signIn">
        <span class="inline-flex items-center gap-2"><MaterialIcon name="login" :size="18" /> {{ t('admin.signInGoogle') }}</span>
      </BaseButton>
    </div>

    <!-- Signed in but no admin role → request coordinator access -->
    <div v-else-if="!admin.isAdmin" class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 max-w-lg mx-auto">
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <MaterialIcon name="warning" :size="22" />
        </div>
        <div>
          <h2 class="font-bold text-slate-900">{{ t('admin.requestTitle') }}</h2>
          <p class="text-sm text-slate-600 mt-1">{{ t('admin.requestBody') }}</p>
          <p class="text-xs font-semibold text-slate-400 mt-2 font-mono">{{ admin.user.email }}</p>
        </div>
      </div>

      <div v-if="requestStatus === 'pending' || requestSent" class="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900 border border-amber-200">
        {{ t('admin.requestPending') }}
      </div>
      <template v-else>
        <div class="space-y-3">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">{{ t('admin.phoneLabel') }} *</label>
            <input
              v-model="requestPhone"
              type="tel"
              :placeholder="t('admin.phonePlaceholder')"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">{{ t('admin.requestNotePlaceholder') }}</label>
            <textarea
              v-model="requestNote"
              :placeholder="t('admin.requestNotePlaceholder')"
              rows="3"
              class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <BaseButton block :disabled="requestPhone.trim().length < 5" @click="submitRequest">{{ t('admin.requestSend') }}</BaseButton>
        </div>
      </template>

      <div class="pt-2 border-t border-slate-100 flex justify-end">
        <button class="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors" @click="admin.signOut()">
          {{ t('admin.signOut') }}
        </button>
      </div>
    </div>

    <!-- Admin dashboard tabs and views -->
    <template v-else>
      <!-- Tab Navigation Headers -->
      <div class="border-b border-slate-200">
        <nav class="flex space-x-2 overflow-x-auto pb-px" aria-label="Tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            @click="activeTab = t.id"
            class="flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 shrink-0 transition-all duration-150"
            :class="activeTab === t.id
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'"
          >
            <MaterialIcon :name="t.icon" :size="18" />
            <span>{{ t.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab Content Area -->
      <div class="py-4">
        <!-- Tab: Solicitudes de Brigadistas -->
        <div v-if="activeTab === 'responder-requests'" class="space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">{{ t('admin.tabResponderRequests') }}</h2>
            <BaseButton variant="neutral" @click="loadTabSpecificData('responder-requests')">
              <span class="flex items-center gap-1"><MaterialIcon name="refresh" :size="16" /> Actualizar</span>
            </BaseButton>
          </div>
          <p v-if="responderRequests.length === 0" class="text-sm text-slate-500 bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
            {{ t('admin.responderRequestsEmpty') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="r in responderRequests" :key="r.email" class="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 truncate">{{ r.name }}</div>
                  <div class="text-xs text-slate-500 truncate font-mono mt-0.5">{{ r.email }}</div>
                  <div v-if="r.phone" class="text-xs text-slate-600 mt-1 flex items-center gap-1 flex-wrap">
                    <MaterialIcon name="phone" :size="14" />
                    <span>{{ r.phone }}</span>
                    <a
                      :href="`https://wa.me/${r.phone.replace(/\D/g, '')}`"
                      target="_blank"
                      class="inline-flex items-center gap-0.5 ml-2 text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      <MaterialIcon name="chat" :size="12" />
                      <span>{{ t('admin.chatWhatsApp') }}</span>
                    </a>
                  </div>
                  <div class="text-xs text-slate-400 mt-1">Solicitado: {{ new Date(r.requestedAt).toLocaleString() }}</div>
                </div>
                <span class="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">Brigadista</span>
              </div>
              <p v-if="r.note" class="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                “{{ r.note }}”
              </p>
              <div class="flex items-center gap-2 pt-1">
                <BaseButton size="small" @click="approveResponder(r.email)">
                  <span class="flex items-center gap-1"><MaterialIcon name="check" :size="16" /> {{ t('admin.reqApprove') }}</span>
                </BaseButton>
                <BaseButton size="small" variant="neutral" @click="denyResponder(r.email)">
                  <span class="flex items-center gap-1"><MaterialIcon name="close" :size="16" /> {{ t('admin.reqDeny') }}</span>
                </BaseButton>
              </div>
            </li>
          </ul>
        </div>

        <!-- Tab: Roster de Brigadistas -->
        <div v-if="activeTab === 'responders-roster'" class="space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">{{ t('admin.tabRespondersRoster') }}</h2>
            <BaseButton variant="neutral" @click="loadTabSpecificData('responders-roster')">
              <span class="flex items-center gap-1"><MaterialIcon name="refresh" :size="16" /> Actualizar</span>
            </BaseButton>
          </div>

          <!-- Search Bar -->
          <div class="relative">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <MaterialIcon name="search" :size="18" />
            </span>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.rosterSearchPlaceholder')"
              class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none text-sm"
            />
          </div>

          <p v-if="filteredResponders.length === 0" class="text-sm text-slate-500 bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
            {{ responders.length === 0 ? t('admin.rosterEmpty') : 'No se encontraron brigadistas para su búsqueda.' }}
          </p>
          <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table class="w-full text-left text-sm divide-y divide-slate-200">
              <thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th class="px-4 py-3">{{ t('admin.colName') }}</th>
                  <th class="px-4 py-3">{{ t('admin.colEmail') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('admin.colActions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="resp in filteredResponders" :key="resp.email" class="hover:bg-slate-50/50">
                  <td class="px-4 py-3 font-medium text-slate-900">{{ resp.name || '—' }}</td>
                  <td class="px-4 py-3 text-slate-600 font-mono text-xs">{{ resp.email }}</td>
                  <td class="px-4 py-3 text-right">
                    <button
                      @click="revokeResponder(resp.email)"
                      class="text-red-600 hover:text-red-900 transition-colors p-1"
                      :title="t('admin.remove')"
                    >
                      <MaterialIcon name="delete" :size="18" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab: Solicitudes de Coordinadores (Command only) -->
        <div v-if="activeTab === 'coordinator-requests' && admin.isCommand" class="space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">{{ t('admin.requestsTitle') }}</h2>
            <BaseButton variant="neutral" @click="loadTabSpecificData('coordinator-requests')">
              <span class="flex items-center gap-1"><MaterialIcon name="refresh" :size="16" /> Actualizar</span>
            </BaseButton>
          </div>
          <p v-if="requests.length === 0" class="text-sm text-slate-500 bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
            {{ t('admin.requestsEmpty') }}
          </p>
          <ul v-else class="space-y-3">
            <li v-for="r in requests" :key="r.email" class="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="font-bold text-slate-900">{{ r.name }}</div>
                  <div class="text-xs text-slate-500 font-mono mt-0.5">{{ r.email }}</div>
                  <div v-if="r.phone" class="text-xs text-slate-600 mt-1 flex items-center gap-1 flex-wrap">
                    <MaterialIcon name="phone" :size="14" />
                    <span>{{ r.phone }}</span>
                    <a
                      :href="`https://wa.me/${r.phone.replace(/\D/g, '')}`"
                      target="_blank"
                      class="inline-flex items-center gap-0.5 ml-2 text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      <MaterialIcon name="chat" :size="12" />
                      <span>{{ t('admin.chatWhatsApp') }}</span>
                    </a>
                  </div>
                  <div class="text-xs text-slate-400 mt-1">Solicitado: {{ new Date(r.requestedAt).toLocaleString() }}</div>
                </div>
              </div>
              <p v-if="r.note" class="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                “{{ r.note }}”
              </p>
              <div class="flex flex-wrap items-center gap-3 pt-1">
                <select v-model="reqRole[r.email]" class="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none">
                  <option value="authority">{{ t('admin.roleAuthority') }}</option>
                  <option value="command">{{ t('admin.roleCommand') }}</option>
                  <option v-if="admin.isSudo" value="sudo">Sudo</option>
                </select>
                <BaseButton @click="approve(r.email)">{{ t('admin.reqApprove') }}</BaseButton>
                <BaseButton variant="neutral" @click="deny(r.email)">{{ t('admin.reqDeny') }}</BaseButton>
              </div>
            </li>
          </ul>
        </div>

        <!-- Tab: Gestión de Coordinadores (Command only) -->
        <div v-if="activeTab === 'coordinators-manage' && admin.isCommand" class="space-y-6 animate-fadeIn">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">{{ t('admin.adminsTitle') }}</h2>
            <BaseButton variant="neutral" @click="loadTabSpecificData('coordinators-manage')">
              <span class="flex items-center gap-1"><MaterialIcon name="refresh" :size="16" /> Actualizar</span>
            </BaseButton>
          </div>
          <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <ul class="divide-y divide-slate-100">
              <li v-for="u in admins" :key="u.email" class="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                <span class="text-sm font-medium text-slate-800 font-mono">{{ u.email }}</span>
                <span class="flex items-center gap-3">
                  <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 uppercase tracking-wider">{{ t('roles.' + u.role) }}</span>
                  <button v-if="u.role !== 'sudo'" class="text-red-600 hover:text-red-900 p-1" @click="removeAdmin(u.email)"><MaterialIcon name="delete" :size="18" /></button>
                  <span v-else class="text-slate-400 p-1" title="Sudo user is locked"><MaterialIcon name="lock" :size="18" /></span>
                </span>
              </li>
            </ul>
          </div>

          <div class="bg-slate-50 p-5 rounded-2xl ring-1 ring-slate-200 space-y-3">
            <h3 class="text-sm font-bold text-slate-900">Agregar nuevo administrador</h3>
            <div class="flex flex-wrap items-center gap-3">
              <input v-model="newEmail" type="email" :placeholder="t('admin.adminsEmailPlaceholder')" class="min-w-[200px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              <select v-model="newRole" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                <option value="authority">{{ t('admin.roleAuthority') }}</option>
                <option value="command">{{ t('admin.roleCommand') }}</option>
                <option v-if="admin.isSudo" value="sudo">Sudo</option>
              </select>
              <BaseButton :disabled="!newEmail" @click="addAdmin">{{ t('admin.add') }}</BaseButton>
            </div>
          </div>
        </div>

        <!-- Tab: Anuncios (Command only) -->
        <div v-if="activeTab === 'announcements' && admin.isCommand" class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          <!-- Broadcast Alert -->
          <div class="space-y-4 bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
            <h2 class="text-lg font-bold text-slate-900">{{ t('admin.broadcastTitle') }}</h2>
            <div class="flex flex-wrap gap-2">
              <BaseButton v-for="c in categories" :key="c" :variant="cat === c ? 'primary' : 'neutral'" size="small" @click="cat = c">
                {{ t('announcements.' + c) }}
              </BaseButton>
            </div>
            <textarea v-model="msg" :placeholder="t('admin.messagePlaceholder')" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            <BaseButton block :disabled="!msg" @click="broadcast">{{ t('admin.broadcastSend') }}</BaseButton>
            <p v-if="sent" class="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1">
              <MaterialIcon name="check_circle" :size="16" /> {{ t('admin.broadcastSent') }}
            </p>
          </div>

          <!-- Active Alerts list -->
          <div class="space-y-4 bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
            <h2 class="text-lg font-bold text-slate-900">{{ t('admin.alertsActiveTitle') }}</h2>
            <p v-if="alerts.length === 0" class="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              {{ t('admin.alertsEmpty') }}
            </p>
            <ul v-else class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <li v-for="a in alerts" :key="a.id" class="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                <div class="min-w-0">
                  <span class="inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">{{ t('announcements.' + a.category) }}</span>
                  <span class="mt-1 block text-sm text-slate-700">{{ a.message }}</span>
                </div>
                <button class="shrink-0 text-red-600 hover:text-red-900 p-1" :title="t('admin.removeAlert')" @click="removeAlert(a.id)">
                  <MaterialIcon name="delete" :size="18" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- Tab: Bitácora (Command only) -->
        <div v-if="activeTab === 'audit-log' && admin.isCommand" class="space-y-6 animate-fadeIn">
          <!-- Full activity log -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-slate-900">{{ t('admin.activityTitle') }}</h2>
              <BaseButton variant="neutral" @click="loadTabSpecificData('audit-log')">
                <span class="flex items-center gap-1"><MaterialIcon name="refresh" :size="16" /> Actualizar</span>
              </BaseButton>
            </div>
            <p v-if="activity.length === 0" class="text-sm text-slate-500 bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
              {{ t('admin.activityEmpty') }}
            </p>
            <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table class="w-full text-left text-sm divide-y divide-slate-200">
                <thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">{{ t('admin.colTime') }}</th>
                    <th class="px-4 py-3">{{ t('admin.colActor') }}</th>
                    <th class="px-4 py-3">{{ t('admin.colAction') }}</th>
                    <th class="px-4 py-3">{{ t('admin.colTarget') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(e, i) in activity" :key="i" class="hover:bg-slate-50/50">
                    <td class="whitespace-nowrap px-4 py-3 text-slate-500 text-xs">{{ new Date(e.timestamp).toLocaleString() }}</td>
                    <td class="px-4 py-3 text-slate-800 font-medium">
                      {{ e.actorId }} <span class="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{{ e.actorRole }}</span>
                    </td>
                    <td class="px-4 py-3 font-mono text-xs text-slate-800">{{ e.action }}</td>
                    <td class="px-4 py-3 text-slate-500 font-mono text-xs">{{ e.targetType ? e.targetType + ':' + e.targetId : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Historical Vouch audit log -->
          <div class="space-y-4 border-t border-slate-200 pt-6">
            <h2 class="text-lg font-bold text-slate-900">Registro histórico de avales (Vouch Audit)</h2>
            <p v-if="audit.length === 0" class="text-sm text-slate-500 bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
              {{ t('admin.auditEmpty') }}
            </p>
            <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table class="w-full text-left text-sm divide-y divide-slate-200">
                <thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">{{ t('admin.colVoucher') }}</th>
                    <th class="px-4 py-3">{{ t('admin.colVouchee') }}</th>
                    <th class="px-4 py-3">{{ t('admin.colTime') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(e, i) in audit" :key="i" class="hover:bg-slate-50/50">
                    <td class="px-4 py-3 text-slate-800">{{ e.voucher }}</td>
                    <td class="px-4 py-3 text-slate-800">{{ e.voucheeDni }}</td>
                    <td class="px-4 py-3 text-slate-500 text-xs">{{ new Date(e.timestamp).toLocaleString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
