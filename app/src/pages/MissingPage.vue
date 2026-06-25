<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMissingStore } from '../stores/missing'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useToast } from '../lib/toast'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import Loader from '../components/Loader.vue'

const { t } = useI18n()
const store = useMissingStore()
const session = useSessionStore()
const admin = useAdminStore()
const toast = useToast()

const canReport = computed(() => session.isVerified || admin.isAdmin)
// Marking found is allowed for the reporter (p.mine) OR a responder/coordinator/admin.
const canMarkFound = (p: { mine?: boolean }) => admin.isAdmin || session.can('responder') || !!p.mine

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.people
  return store.people.filter((p) => p.name.toLowerCase().includes(q))
})

// Report form
const showForm = ref(false)
const f = ref({ name: '', details: '', address: '', lastSeen: '', phone: '', contactPhone: '' })

// Found-provenance form (per card)
const foundFor = ref<string | null>(null)
const fb = ref({ byPhone: '', note: '' })

onMounted(() => store.fetchAll())

async function submit() {
  if (!f.value.name) return
  const r = await store.report({
    name: f.value.name,
    details: f.value.details || undefined,
    address: f.value.address || undefined,
    lastSeen: f.value.lastSeen || undefined,
    phone: f.value.phone || undefined,
    contactPhone: f.value.contactPhone || undefined,
  })
  if (r.ok) {
    toast.success(t('missing.form.submitted'))
    f.value = { name: '', details: '', address: '', lastSeen: '', phone: '', contactPhone: '' }
    showForm.value = false
  } else {
    toast.error(r.error || t('common.error'))
  }
}

function openFound(id: string) {
  foundFor.value = id
  fb.value = { byPhone: '', note: '' }
}
async function confirmFound(id: string) {
  const r = await store.markFound(id, {
    byPhone: fb.value.byPhone || undefined,
    note: fb.value.note || undefined,
  })
  if (r.ok) { toast.success(t('missing.markedFound')); foundFor.value = null }
  else toast.error(r.error || t('common.error'))
}
</script>

<template>
  <div class="mx-auto space-y-5 p-4">
    <header class="space-y-1">
      <h1 class="text-xl font-bold text-slate-900">{{ t('missing.title') }}</h1>
      <p class="text-sm text-slate-600">{{ t('missing.intro') }}</p>
    </header>

    <!-- Prominent report action -->
    <BaseButton v-if="canReport" block @click="showForm = !showForm">
      <span class="inline-flex items-center justify-center gap-2"><MaterialIcon name="person_add" :size="20" /> {{ t('missing.report') }}</span>
    </BaseButton>
    <p v-else class="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{{ t('missing.needVerify') }}</p>

    <!-- Search -->
    <div class="relative">
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><MaterialIcon name="search" :size="20" /></span>
      <input v-model="search" :placeholder="t('missing.search')" class="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3" />
    </div>

    <!-- Report form -->
    <section v-if="showForm && canReport" class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">{{ t('missing.form.heading') }}</h2>
      <div v-for="field in (['name','details','address','lastSeen','phone','contactPhone'] as const)" :key="field" class="space-y-1.5">
        <label class="text-sm font-medium text-slate-800">{{ t('missing.form.' + field) }}</label>
        <input v-model="f[field]" :placeholder="t('missing.form.' + field + 'Placeholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
      </div>
      <div class="flex gap-2">
        <BaseButton :disabled="!f.name" @click="submit">{{ t('missing.form.submit') }}</BaseButton>
        <BaseButton variant="neutral" @click="showForm = false">{{ t('missing.form.cancel') }}</BaseButton>
      </div>
    </section>

    <!-- List -->
    <Loader v-if="store.loading" :label="t('common.loading')" class="py-4" />
    <p v-else-if="store.people.length === 0" class="text-sm text-slate-500">{{ t('missing.empty') }}</p>
    <p v-else-if="filtered.length === 0" class="text-sm text-slate-500">{{ t('missing.noResults') }}</p>
    <ul v-else class="space-y-2">
      <li v-for="p in filtered" :key="p.id" class="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold text-slate-900">{{ p.name }}</h3>
              <span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="p.status === 'found' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">
                {{ p.status === 'found' ? t('missing.statusFound') : t('missing.statusMissing') }}
              </span>
            </div>
            <p v-if="p.details" class="mt-1 text-sm text-slate-700">{{ p.details }}</p>
            <p v-if="p.address" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.addressLabel') }}:</strong> {{ p.address }}</p>
            <p v-if="p.lastSeen" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.lastSeenLabel') }}:</strong> {{ p.lastSeen }}</p>
            <p v-if="p.phone" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.phoneLabel') }}:</strong> {{ p.phone }}</p>
            <p v-if="p.contactName" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.requestedByLabel') }}:</strong> {{ p.contactName }}</p>
            <p v-if="p.contactPhone" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.infoAtLabel') }}:</strong> {{ p.contactPhone }}</p>
            <p v-if="p.status === 'found' && p.foundBy" class="mt-1 text-sm text-emerald-700">
              <strong>{{ t('missing.foundByLabel') }}:</strong>
              {{ p.foundBy.name || '—' }}<template v-if="p.foundBy.phone"> · {{ p.foundBy.phone }}</template><template v-if="p.foundBy.note"> · {{ p.foundBy.note }}</template>
            </p>
          </div>
          <button
            v-if="canMarkFound(p) && p.status === 'missing'"
            class="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"
            @click="openFound(p.id)"
          >
            {{ t('missing.markFound') }}
          </button>
        </div>

        <!-- Found-provenance form -->
        <div v-if="foundFor === p.id" class="space-y-3 rounded-xl bg-emerald-50 p-3">
          <p class="text-sm font-semibold text-emerald-900">{{ t('missing.found.heading') }}</p>
          <div class="space-y-1">
            <label class="text-xs font-medium text-emerald-900">{{ t('missing.found.byPhone') }}</label>
            <input v-model="fb.byPhone" :placeholder="t('missing.found.byPhonePlaceholder')" class="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-emerald-900">{{ t('missing.found.note') }}</label>
            <input v-model="fb.note" :placeholder="t('missing.found.notePlaceholder')" class="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm" />
          </div>
          <div class="flex gap-2">
            <BaseButton @click="confirmFound(p.id)">{{ t('missing.found.confirm') }}</BaseButton>
            <BaseButton variant="neutral" @click="foundFor = null">{{ t('missing.form.cancel') }}</BaseButton>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
