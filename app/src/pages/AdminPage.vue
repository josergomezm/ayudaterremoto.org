<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore, type AuditEntry, type AuditLogEntry, type AdminUser, type AccessRequest, type AnnouncementCategory, type Announcement } from '../stores/admin'
import { useToast } from '../lib/toast'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import Loader from '../components/Loader.vue'

const { t } = useI18n()
const toast = useToast()
const admin = useAdminStore()

const code = ref('')
const copied = ref(false)
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
const requestStatus = ref<string | null>(null)
const requestSent = ref(false)

async function loadCommandData() {
  const a = await admin.fetchAudit()
  if (a.ok) audit.value = a.data.entries
  const u = await admin.listAdmins()
  if (u.ok) admins.value = u.data.users
  const rq = await admin.listRequests()
  if (rq.ok) {
    requests.value = rq.data.requests
    for (const x of requests.value) if (!reqRole.value[x.email]) reqRole.value[x.email] = 'authority'
  }
  const an = await admin.listAnnouncements()
  if (an.ok) alerts.value = an.data.announcements
  const act = await admin.fetchActivity()
  if (act.ok) activity.value = act.data.entries
}
watch(() => admin.isCommand, (v) => { if (v) loadCommandData() }, { immediate: true })

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
    // Signed in but no admin role → the request-access panel will show.
    if (admin.user && !admin.isAdmin) toast.info(t('admin.noAccessBody'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('common.error'))
  }
}

async function submitRequest() {
  const r = await admin.requestAccess(requestNote.value)
  if (r.ok) { requestSent.value = true; requestStatus.value = 'pending'; toast.success(t('admin.requestPending')) }
  else toast.error(r.error || t('common.error'))
}
async function approve(email: string) {
  const r = await admin.approveRequest(email, reqRole.value[email] ?? 'authority')
  if (r.ok) { await loadCommandData(); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function deny(email: string) {
  const r = await admin.denyRequest(email)
  if (r.ok) { await loadCommandData(); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}

async function generate() {
  const r = await admin.generateCode()
  if (r.ok) { code.value = r.data.code; copied.value = false }
  else toast.error(r.error || t('common.error'))
}
function copyCode() {
  navigator.clipboard?.writeText(code.value)
  copied.value = true
  toast.success(t('admin.copied'))
}
async function addAdmin() {
  if (!newEmail.value) return
  const r = await admin.setAdmin(newEmail.value, newRole.value)
  if (r.ok) { newEmail.value = ''; await loadCommandData(); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function removeAdmin(email: string) {
  const r = await admin.removeAdmin(email)
  if (r.ok) { await loadCommandData(); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
async function broadcast() {
  if (!msg.value) return
  const r = await admin.broadcast(cat.value, msg.value)
  if (r.ok) { sent.value = true; msg.value = ''; await loadCommandData(); toast.success(t('admin.broadcastSent')) }
  else toast.error(r.error || t('common.error'))
}
async function removeAlert(id: string) {
  const r = await admin.deleteAnnouncement(id)
  if (r.ok) { await loadCommandData(); toast.success(t('common.saved')) }
  else toast.error(r.error || t('common.error'))
}
</script>

<template>
  <div class="mx-auto  space-y-5 p-4">
    <header class="space-y-1">
      <h1 class="text-xl font-bold text-slate-900">{{ t('admin.title') }}</h1>
      <p class="text-sm text-slate-600">{{ t('admin.subtitle') }}</p>
    </header>

    <!-- Loading auth state -->
    <Loader v-if="!admin.ready" :label="t('common.loading')" class="py-6" />

    <!-- Not signed in -->
    <div v-else-if="!admin.user" class="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <BaseButton @click="signIn">
        <span class="inline-flex items-center gap-2"><MaterialIcon name="login" :size="18" /> {{ t('admin.signInGoogle') }}</span>
      </BaseButton>
    </div>

    <!-- Signed in but no admin role → request vouching access -->
    <div v-else-if="!admin.isAdmin" class="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">{{ t('admin.requestTitle') }}</h2>
      <p class="text-sm text-slate-600">{{ t('admin.requestBody') }}</p>
      <p v-if="admin.user" class="text-xs text-slate-400">{{ admin.user.email }}</p>

      <p v-if="requestStatus === 'pending' || requestSent" class="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
        {{ t('admin.requestPending') }}
      </p>
      <template v-else>
        <textarea v-model="requestNote" :placeholder="t('admin.requestNotePlaceholder')" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        <BaseButton @click="submitRequest">{{ t('admin.requestSend') }}</BaseButton>
      </template>

      <div class="pt-1">
        <button class="text-sm font-semibold text-slate-500" @click="admin.signOut()">{{ t('admin.signOut') }}</button>
      </div>
    </div>

    <!-- Admin dashboard -->
    <template v-else>
      <div class="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2 text-sm">
        <span class="text-slate-700">{{ t('admin.signedInAs', { email: admin.user?.email, role: t('roles.' + admin.role) }) }}</span>
        <button class="font-semibold text-slate-500" @click="admin.signOut()">{{ t('admin.signOut') }}</button>
      </div>

      <!-- Generate vouch code (Authority+) -->
      <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="font-semibold text-slate-900">{{ t('admin.vouchTitle') }}</h2>
        <p class="text-sm text-slate-600">{{ t('admin.vouchDesc') }}</p>
        <div v-if="code" class="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
          <span class="font-mono text-xl font-bold tracking-widest text-white">{{ code }}</span>
          <button class="flex items-center gap-1 text-sm font-semibold text-white/80" @click="copyCode">
            <MaterialIcon :name="copied ? 'check' : 'content_copy'" :size="18" />
            {{ copied ? t('admin.copied') : t('admin.copy') }}
          </button>
        </div>
        <BaseButton @click="generate">{{ t('admin.generate') }}</BaseButton>
      </section>

      <!-- Command-only sections -->
      <template v-if="admin.isCommand">
        <!-- Broadcast -->
        <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold text-slate-900">{{ t('admin.broadcastTitle') }}</h2>
          <div class="flex flex-wrap gap-2">
            <BaseButton v-for="c in categories" :key="c" :variant="cat === c ? 'primary' : 'neutral'" @click="cat = c">
              {{ t('announcements.' + c) }}
            </BaseButton>
          </div>
          <textarea v-model="msg" :placeholder="t('admin.messagePlaceholder')" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <BaseButton :disabled="!msg" @click="broadcast">{{ t('admin.broadcastSend') }}</BaseButton>
          <p v-if="sent" class="text-sm font-medium text-emerald-700">{{ t('admin.broadcastSent') }}</p>
        </section>

        <!-- Active alerts (clear the banner once stale) -->
        <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold text-slate-900">{{ t('admin.alertsActiveTitle') }}</h2>
          <p v-if="alerts.length === 0" class="text-sm text-slate-500">{{ t('admin.alertsEmpty') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="a in alerts" :key="a.id" class="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <span class="min-w-0">
                <span class="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{{ t('announcements.' + a.category) }}</span>
                <span class="mt-1 block text-sm text-slate-700">{{ a.message }}</span>
              </span>
              <button class="shrink-0 text-red-600" :title="t('admin.removeAlert')" @click="removeAlert(a.id)">
                <MaterialIcon name="delete" :size="18" />
              </button>
            </li>
          </ul>
        </section>

        <!-- Access requests -->
        <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold text-slate-900">{{ t('admin.requestsTitle') }}</h2>
          <p v-if="requests.length === 0" class="text-sm text-slate-500">{{ t('admin.requestsEmpty') }}</p>
          <ul v-else class="space-y-3">
            <li v-for="r in requests" :key="r.email" class="space-y-2 rounded-xl bg-slate-50 p-3">
              <div>
                <div class="font-medium text-slate-800">{{ r.name }}</div>
                <div class="text-sm text-slate-500">{{ r.email }}</div>
                <p v-if="r.note" class="mt-1 text-sm italic text-slate-600">“{{ r.note }}”</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <select v-model="reqRole[r.email]" class="rounded-xl border border-slate-300 px-3 py-2">
                  <option value="authority">{{ t('admin.roleAuthority') }}</option>
                  <option value="command">{{ t('admin.roleCommand') }}</option>
                </select>
                <BaseButton @click="approve(r.email)">{{ t('admin.reqApprove') }}</BaseButton>
                <BaseButton variant="neutral" @click="deny(r.email)">{{ t('admin.reqDeny') }}</BaseButton>
              </div>
            </li>
          </ul>
        </section>

        <!-- Manage admins -->
        <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold text-slate-900">{{ t('admin.adminsTitle') }}</h2>
          <ul class="divide-y divide-slate-100">
            <li v-for="u in admins" :key="u.email" class="flex items-center justify-between py-2 text-sm">
              <span class="text-slate-800">{{ u.email }}</span>
              <span class="flex items-center gap-3">
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{{ t('roles.' + u.role) }}</span>
                <button class="text-red-600" @click="removeAdmin(u.email)"><MaterialIcon name="delete" :size="18" /></button>
              </span>
            </li>
          </ul>
          <div class="flex flex-wrap items-center gap-2">
            <input v-model="newEmail" type="email" :placeholder="t('admin.adminsEmailPlaceholder')" class="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5" />
            <select v-model="newRole" class="rounded-xl border border-slate-300 px-3 py-2.5">
              <option value="authority">{{ t('admin.roleAuthority') }}</option>
              <option value="command">{{ t('admin.roleCommand') }}</option>
            </select>
            <BaseButton :disabled="!newEmail" @click="addAdmin">{{ t('admin.add') }}</BaseButton>
          </div>
        </section>

        <!-- Vouch audit log -->
        <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold text-slate-900">{{ t('admin.auditTitle') }}</h2>
          <p v-if="audit.length === 0" class="text-sm text-slate-500">{{ t('admin.auditEmpty') }}</p>
          <table v-else class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400">
              <tr><th class="py-1">{{ t('admin.colVoucher') }}</th><th>{{ t('admin.colVouchee') }}</th><th>{{ t('admin.colTime') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(e, i) in audit" :key="i" class="border-t border-slate-100">
                <td class="py-1.5 text-slate-800">{{ e.voucher }}</td>
                <td class="text-slate-800">{{ e.voucheeDni }}</td>
                <td class="text-slate-500">{{ new Date(e.timestamp).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Full activity log (everything) -->
        <section class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold text-slate-900">{{ t('admin.activityTitle') }}</h2>
          <p v-if="activity.length === 0" class="text-sm text-slate-500">{{ t('admin.activityEmpty') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase text-slate-400">
                <tr><th class="py-1">{{ t('admin.colTime') }}</th><th>{{ t('admin.colActor') }}</th><th>{{ t('admin.colAction') }}</th><th>{{ t('admin.colTarget') }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in activity" :key="i" class="border-t border-slate-100">
                  <td class="whitespace-nowrap py-1.5 text-slate-500">{{ new Date(e.timestamp).toLocaleString() }}</td>
                  <td class="text-slate-800">{{ e.actorId }} <span class="text-slate-400">({{ e.actorRole }})</span></td>
                  <td class="font-mono text-slate-800">{{ e.action }}</td>
                  <td class="text-slate-500">{{ e.targetType ? e.targetType + ':' + e.targetId : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
