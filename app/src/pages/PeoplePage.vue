<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMissingStore } from '../stores/missing'
import { useBuildingsStore } from '../stores/buildings'
import { usePatientsStore } from '../stores/patients'
import { useSessionStore } from '../stores/session'
import { useAdminStore } from '../stores/admin'
import { useToast } from '../lib/toast'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'
import Loader from '../components/Loader.vue'
import { formatRelativeTime, formatAbsoluteTime } from '../lib/date'

const { t, locale } = useI18n()
const store = useMissingStore()
const buildingsStore = useBuildingsStore()
const patientsStore = usePatientsStore()
const session = useSessionStore()
const admin = useAdminStore()
const toast = useToast()

const activeTab = ref<'people' | 'patients' | 'buildings'>('people')

const canReport = computed(() => session.isVerified || admin.isAdmin)
const canResolveBuilding = computed(() => session.can('rescatista') || admin.isAdmin)
const canImportPatients = computed(() => session.can('coordinador') || admin.isAdmin)

// People Search
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.people
  return store.people.filter((p) => p.name.toLowerCase().includes(q))
})

// People Report form
const showForm = ref(false)
const f = ref({ name: '', dni: '', details: '', address: '', lastSeen: '', phone: '', contactPhone: '' })

// Found-provenance form (per card)
const foundFor = ref<string | null>(null)
const fb = ref({ byPhone: '', note: '' })

// Patients Search
const patientsSearch = ref('')
const filteredPatients = computed(() => {
  const q = patientsSearch.value.trim().toLowerCase()
  if (!q) return patientsStore.patients
  return patientsStore.patients.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    (p.dni && p.dni.includes(q)) ||
    p.hospitalName.toLowerCase().includes(q)
  )
})

// Patients Import modal and form
const showImportModal = ref(false)
const importMethod = ref<'text' | 'image'>('text')
const importForm = ref({ hospitalName: '', textInput: '', imageBase64: '' })
const selectedFileName = ref('')

// Buildings Search
const buildingsSearch = ref('')
const filteredBuildings = computed(() => {
  const q = buildingsSearch.value.trim().toLowerCase()
  if (!q) return buildingsStore.requests
  return buildingsStore.requests.filter((r) => 
    r.buildingName.toLowerCase().includes(q) || 
    (r.address && r.address.toLowerCase().includes(q))
  )
})

// Buildings Report form
const showBuildingForm = ref(false)
const bf = ref({ buildingName: '', address: '', note: '', contactPhone: '' })

// Resolve building request form (per card)
const resolveFor = ref<string | null>(null)
const rf = ref<{ condition: 'safe' | 'damaged' | 'collapsed' | 'unknown'; note: string }>({
  condition: 'safe',
  note: ''
})

onMounted(() => {
  store.fetchAll()
  buildingsStore.fetchAll()
  patientsStore.fetchAll()
})

async function submit() {
  if (!f.value.name) return
  const r = await store.report({
    name: f.value.name,
    dni: f.value.dni || undefined,
    details: f.value.details || undefined,
    address: f.value.address || undefined,
    lastSeen: f.value.lastSeen || undefined,
    phone: f.value.phone || undefined,
    contactPhone: f.value.contactPhone || undefined,
  })
  if (r.ok) {
    toast.success(t('missing.form.submitted'))
    f.value = { name: '', dni: '', details: '', address: '', lastSeen: '', phone: '', contactPhone: '' }
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

// Buildings Actions
async function submitBuilding() {
  if (!bf.value.buildingName) return
  const r = await buildingsStore.createRequest({
    buildingName: bf.value.buildingName,
    address: bf.value.address || undefined,
    note: bf.value.note || undefined,
    contactPhone: bf.value.contactPhone || undefined,
  })
  if (r.ok) {
    toast.success(t('buildings.form.submitted'))
    bf.value = { buildingName: '', address: '', note: '', contactPhone: '' }
    showBuildingForm.value = false
  } else {
    toast.error(r.error || t('common.error'))
  }
}

function openResolveBuilding(id: string) {
  resolveFor.value = id
  rf.value = { condition: 'safe', note: '' }
}
async function confirmResolveBuilding(id: string) {
  if (!rf.value.note) return
  const r = await buildingsStore.resolveRequest(id, {
    condition: rf.value.condition,
    note: rf.value.note
  })
  if (r.ok) {
    toast.success(t('buildings.markedResolved'))
    resolveFor.value = null
  } else {
    toast.error(r.error || t('common.error'))
  }
}

// Patients Actions
function onImageSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  selectedFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (ev) => {
    importForm.value.imageBase64 = ev.target?.result as string
  }
  reader.readAsDataURL(file)
}

function closeImport() {
  showImportModal.value = false
  importForm.value = { hospitalName: '', textInput: '', imageBase64: '' }
  selectedFileName.value = ''
}

async function submitImport() {
  if (!importForm.value.hospitalName) return
  const res = await patientsStore.importList({
    hospitalName: importForm.value.hospitalName,
    textInput: importMethod.value === 'text' ? importForm.value.textInput : undefined,
    imageBase64: importMethod.value === 'image' ? importForm.value.imageBase64 : undefined,
  })
  if (res.ok) {
    toast.success(`Lista importada. Se detectaron ${res.data.matchedCount} coincidencias con personas desaparecidas.`)
    closeImport()
    await store.fetchAll() // Refresh missing persons to update statuses/cross-references
  } else {
    toast.error(res.error || 'Error al analizar la lista de pacientes')
  }
}

// Cross-referencing helpers
const getMissingPersonName = (id: string) => {
  return store.people.find(p => p.id === id)?.name || 'Persona Desaparecida'
}

const getMissingPersonContact = (id: string) => {
  const p = store.people.find(p => p.id === id)
  if (!p) return ''
  return [p.contactName, p.contactPhone].filter(Boolean).join(' - ')
}

const getAdmittedPatientForMissing = (missingId: string) => {
  return patientsStore.patients.find(p => p.matchedMissingId === missingId)
}

// Marking found is allowed for the reporter (p.mine) OR a responder/coordinator/admin.
const canMarkFound = (p: { mine?: boolean }) => admin.isAdmin || session.can('rescatista') || !!p.mine
</script>

<template>
  <div class="supply-theme people-page">
    <div class="wrap space-y-5">
      <header class="space-y-1">
      <h1 class="text-xl font-bold text-slate-900">{{ t('missing.title') }}</h1>
      <p class="text-sm text-slate-600">{{ t('missing.intro') }}</p>
    </header>

    <!-- Tab Selector -->
    <div class="flex rounded-xl bg-slate-100 p-1">
      <button
        class="flex-1 rounded-lg py-2 text-sm font-semibold text-center transition-all cursor-pointer"
        :class="activeTab === 'people' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'people'"
      >
        {{ t('missing.tabPeople') }}
      </button>
      <button
        class="flex-1 rounded-lg py-2 text-sm font-semibold text-center transition-all cursor-pointer"
        :class="activeTab === 'patients' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'patients'"
      >
        {{ t('missing.patients.tabPatients') }}
      </button>
      <button
        class="flex-1 rounded-lg py-2 text-sm font-semibold text-center transition-all cursor-pointer"
        :class="activeTab === 'buildings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'buildings'"
      >
        {{ t('missing.tabBuildings') }}
      </button>
    </div>

    <!-- ── PEOPLE (MISSING) TAB ─────────────────────────────────────────── -->
    <template v-if="activeTab === 'people'">
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
        <div v-for="field in (['name','dni','details','address','lastSeen','phone','contactPhone'] as const)" :key="field" class="space-y-1.5">
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
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-semibold text-slate-900">{{ p.name }}</h3>
                <span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="p.status === 'found' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">
                  {{ p.status === 'found' ? t('missing.statusFound') : t('missing.statusMissing') }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">
                {{ t('missing.registeredLabel') }}: {{ formatRelativeTime(p.createdAt, locale) }} ({{ formatAbsoluteTime(p.createdAt, locale) }})
              </p>
              <p v-if="p.details" class="mt-1 text-sm text-slate-700">{{ p.details }}</p>
              <p v-if="p.dni" class="mt-0.5 text-sm text-slate-500"><strong>Cédula/DNI:</strong> {{ p.dni }}</p>
              <p v-if="p.address" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.addressLabel') }}:</strong> {{ p.address }}</p>
              <p v-if="p.lastSeen" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.lastSeenLabel') }}:</strong> {{ p.lastSeen }}</p>
              <p v-if="p.phone" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.phoneLabel') }}:</strong> {{ p.phone }}</p>
              <p v-if="p.contactName" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.requestedByLabel') }}:</strong> {{ p.contactName }}</p>
              <p v-if="p.contactPhone" class="mt-0.5 text-sm text-slate-500"><strong>{{ t('missing.infoAtLabel') }}:</strong> {{ p.contactPhone }}</p>
              <p v-if="p.status === 'found' && p.foundBy" class="mt-1 text-sm text-emerald-700">
                <strong>{{ t('missing.foundByLabel') }}:</strong>
                {{ p.foundBy.name || '—' }}<template v-if="p.foundBy.phone"> · {{ p.foundBy.phone }}</template><template v-if="p.foundBy.note"> · {{ p.foundBy.note }}</template>
              </p>

              <!-- Admitted Patient Match Cross-Reference -->
              <div v-if="getAdmittedPatientForMissing(p.id)" class="mt-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100 flex items-start gap-2">
                <MaterialIcon name="check_circle" class="text-emerald-700 shrink-0 mt-0.5" :size="18" />
                <div class="text-xs text-emerald-900">
                  <p class="font-bold text-[13px]">{{ t('missing.patients.matchLocated') }}</p>
                  <p class="mt-0.5"><span class="font-semibold">Hospital:</span> {{ getAdmittedPatientForMissing(p.id)?.hospitalName }}</p>
                  <p v-if="getAdmittedPatientForMissing(p.id)?.notes" class="mt-0.5"><span class="font-semibold">{{ t('missing.patients.matchMedicalNotes') }}:</span> {{ getAdmittedPatientForMissing(p.id)?.notes }}</p>
                </div>
              </div>
            </div>
            <button
              v-if="canMarkFound(p) && p.status === 'missing'"
              class="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 cursor-pointer"
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
    </template>

    <!-- ── HOSPITALIZED PATIENTS TAB ──────────────────────────────────── -->
    <template v-else-if="activeTab === 'patients'">
      <!-- Import List Button (Responder+) -->
      <BaseButton v-if="canImportPatients" block @click="showImportModal = true">
        <span class="inline-flex items-center justify-center gap-2">
          <MaterialIcon name="upload_file" :size="20" />
          {{ t('missing.patients.importButton') }}
        </span>
      </BaseButton>

      <!-- Search -->
      <div class="relative">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><MaterialIcon name="search" :size="20" /></span>
        <input v-model="patientsSearch" :placeholder="t('missing.patients.searchPlaceholder')" class="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3" />
      </div>

      <!-- List -->
      <Loader v-if="patientsStore.loading" :label="t('common.loading')" class="py-4" />
      <p v-else-if="patientsStore.patients.length === 0" class="text-sm text-slate-500">{{ t('missing.patients.empty') }}</p>
      <p v-else-if="filteredPatients.length === 0" class="text-sm text-slate-500">{{ t('missing.noResults') }}</p>
      <ul v-else class="space-y-2">
        <li v-for="p in filteredPatients" :key="p.id" class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-semibold text-slate-900 text-base">{{ p.name }}</h3>
              <p class="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">{{ p.hospitalName }}</p>
              <p v-if="p.dni" class="text-sm text-slate-600 mt-1"><strong>{{ t('missing.patients.dniLabel') }}:</strong> {{ p.dni }}</p>
              <p v-if="p.notes" class="text-sm text-slate-600 mt-0.5"><strong>{{ t('missing.patients.notesLabel') }}:</strong> {{ p.notes }}</p>
              <p class="text-[11px] text-slate-400 mt-1.5">{{ t('missing.patients.registeredLabel') }}: {{ formatRelativeTime(p.createdAt, locale) }} ({{ formatAbsoluteTime(p.createdAt, locale) }})</p>
            </div>
          </div>

          <!-- Cross-referenced missing person warning -->
          <div v-if="p.matchedMissingId" class="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100 flex items-start gap-2 mt-2">
            <MaterialIcon name="warning" class="text-amber-700 shrink-0 mt-0.5" :size="18" />
            <div class="text-xs text-amber-900">
              <p class="font-bold">{{ t('missing.patients.matchHeading') }}</p>
              <p class="mt-0.5"><span class="font-semibold">{{ t('missing.patients.matchName') }}:</span> {{ getMissingPersonName(p.matchedMissingId) }}</p>
              <p v-if="getMissingPersonContact(p.matchedMissingId)" class="mt-0.5"><span class="font-semibold">{{ t('missing.patients.matchContact') }}:</span> {{ getMissingPersonContact(p.matchedMissingId) }}</p>
            </div>
          </div>
        </li>
      </ul>

      <!-- Import Patients Modal -->
      <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 space-y-4">
          <h2 class="text-lg font-bold text-slate-900">{{ t('missing.patients.importHeading') }}</h2>
          
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('missing.patients.hospitalLabel') }}</label>
            <input v-model="importForm.hospitalName" :placeholder="t('missing.patients.hospitalPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>

          <div class="flex rounded-lg bg-slate-100 p-1 text-xs">
            <button 
              class="flex-1 rounded-md py-1.5 font-semibold text-center transition-all cursor-pointer"
              :class="importMethod === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
              @click="importMethod = 'text'"
            >
              {{ t('missing.patients.importMethodText') }}
            </button>
            <button 
              class="flex-1 rounded-md py-1.5 font-semibold text-center transition-all cursor-pointer"
              :class="importMethod === 'image' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
              @click="importMethod = 'image'"
            >
              {{ t('missing.patients.importMethodImage') }}
            </button>
          </div>

          <div v-if="importMethod === 'text'" class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('missing.patients.textLabel') }}</label>
            <textarea v-model="importForm.textInput" :placeholder="t('missing.patients.textPlaceholder')" rows="5" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"></textarea>
          </div>

          <div v-if="importMethod === 'image'" class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('missing.patients.imageLabel') }}</label>
            <div class="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:bg-slate-50 relative">
              <input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" @change="onImageSelected" />
              <MaterialIcon name="image" :size="32" class="text-slate-400 mb-1" />
              <span class="text-xs text-slate-500 font-medium">{{ t('missing.patients.imagePlaceholder') }}</span>
              <span v-if="selectedFileName" class="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">{{ selectedFileName }}</span>
            </div>
          </div>

          <div class="flex gap-2 justify-end pt-2">
            <BaseButton variant="neutral" :disabled="patientsStore.importing" @click="closeImport">{{ t('missing.form.cancel') }}</BaseButton>
            <BaseButton :disabled="patientsStore.importing || !importForm.hospitalName || (importMethod === 'text' && !importForm.textInput) || (importMethod === 'image' && !importForm.imageBase64)" @click="submitImport">
              <span class="inline-flex items-center gap-1.5">
                <span v-if="patientsStore.importing" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                {{ patientsStore.importing ? t('missing.patients.importSubmitLoading') : t('missing.patients.importSubmit') }}
              </span>
            </BaseButton>
          </div>
        </div>
      </div>
    </template>

    <!-- ── BUILDINGS TAB ──────────────────────────────────────── -->
    <template v-else>
      <!-- Prominent request action -->
      <BaseButton v-if="canReport" block @click="showBuildingForm = !showBuildingForm">
        <span class="inline-flex items-center justify-center gap-2"><MaterialIcon name="domain_add" :size="20" /> {{ t('missing.buildingReport') }}</span>
      </BaseButton>
      <p v-else class="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{{ t('missing.buildingNeedVerify') }}</p>

      <!-- Search -->
      <div class="relative">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><MaterialIcon name="search" :size="20" /></span>
        <input v-model="buildingsSearch" :placeholder="t('missing.buildingSearch')" class="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3" />
      </div>

      <!-- Report form -->
      <section v-if="showBuildingForm && canReport" class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="font-semibold text-slate-900">{{ t('missing.buildingForm.heading') }}</h2>
        
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-slate-800">{{ t('missing.buildingForm.name') }}</label>
          <input v-model="bf.buildingName" :placeholder="t('missing.buildingForm.namePlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </div>
        
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-slate-800">{{ t('missing.buildingForm.address') }}</label>
          <input v-model="bf.address" :placeholder="t('missing.buildingForm.addressPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-slate-800">{{ t('missing.buildingForm.note') }}</label>
          <textarea v-model="bf.note" :placeholder="t('missing.buildingForm.notePlaceholder')" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-slate-800">{{ t('missing.buildingForm.contactPhone') }}</label>
          <input v-model="bf.contactPhone" :placeholder="t('missing.buildingForm.contactPhonePlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </div>

        <div class="flex gap-2">
          <BaseButton :disabled="!bf.buildingName" @click="submitBuilding">{{ t('missing.buildingForm.submit') }}</BaseButton>
          <BaseButton variant="neutral" @click="showBuildingForm = false">{{ t('missing.form.cancel') }}</BaseButton>
        </div>
      </section>

      <!-- List -->
      <Loader v-if="buildingsStore.loading" :label="t('common.loading')" class="py-4" />
      <p v-else-if="buildingsStore.requests.length === 0" class="text-sm text-slate-500">{{ t('missing.buildingEmpty') }}</p>
      <p v-else-if="filteredBuildings.length === 0" class="text-sm text-slate-500">{{ t('missing.noResults') }}</p>
      <ul v-else class="space-y-2">
        <li v-for="r in filteredBuildings" :key="r.id" class="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-semibold text-slate-900">{{ r.buildingName }}</h3>
                
                <!-- Status & Condition Pill -->
                <span 
                  v-if="r.status === 'pending'"
                  class="rounded-full px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800"
                >
                  {{ t('missing.statusPending') }}
                </span>
                <span 
                  v-else-if="r.status === 'resolved' && r.resolution"
                  class="rounded-full px-2 py-0.5 text-xs font-bold"
                  :class="{
                    'bg-emerald-100 text-emerald-800': r.resolution.condition === 'safe',
                    'bg-orange-100 text-orange-800': r.resolution.condition === 'damaged',
                    'bg-red-100 text-red-800': r.resolution.condition === 'collapsed',
                    'bg-slate-100 text-slate-800': r.resolution.condition === 'unknown',
                  }"
                >
                  {{ t('missing.condition' + r.resolution.condition.charAt(0).toUpperCase() + r.resolution.condition.slice(1)) }}
                </span>
              </div>

              <p v-if="r.address" class="mt-1 text-sm text-slate-600">
                <strong>{{ t('missing.addressLabel') }}:</strong> {{ r.address }}
              </p>
              
              <p v-if="r.note" class="mt-1 text-sm text-slate-500 italic">
                "{{ r.note }}"
              </p>
              
              <p class="mt-2 text-xs text-slate-400">
                {{ t('missing.requestedByLabel') }}: {{ r.reporterName }} <span class="mx-1">•</span> {{ formatRelativeTime(r.createdAt, locale) }} ({{ formatAbsoluteTime(r.createdAt, locale) }})
              </p>

              <!-- Resolution / Reply Details -->
              <div 
                v-if="r.status === 'resolved' && r.resolution" 
                class="mt-3 rounded-xl bg-slate-50 p-3 border-l-4"
                :class="{
                  'border-emerald-500': r.resolution.condition === 'safe',
                  'border-orange-500': r.resolution.condition === 'damaged',
                  'border-red-500': r.resolution.condition === 'collapsed',
                  'border-slate-400': r.resolution.condition === 'unknown',
                }"
              >
                <p class="text-sm font-semibold text-slate-800">
                  {{ r.resolution.note }}
                </p>
                <p class="mt-1 text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>Por: {{ r.resolution.answeredBy.name }} ({{ r.resolution.answeredBy.role }})</span>
                  <span class="text-slate-300">•</span>
                  <span>{{ t('missing.resolvedLabel') }}: {{ formatRelativeTime(r.resolution.at, locale) }} ({{ formatAbsoluteTime(r.resolution.at, locale) }})</span>
                </p>
              </div>
            </div>

            <!-- Resolve / Reply Trigger -->
            <button
              v-if="canResolveBuilding && (r.status !== 'resolved' || admin.isAdmin)"
              class="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 cursor-pointer"
              @click="openResolveBuilding(r.id)"
            >
              {{ t('missing.resolveBuilding') }}
            </button>
          </div>

          <!-- Resolve building form -->
          <div v-if="resolveFor === r.id" class="space-y-3 rounded-xl bg-indigo-50/50 p-3">
            <p class="text-sm font-semibold text-indigo-900">{{ t('missing.buildingResolve.heading') }}</p>
            
            <div class="space-y-1">
              <label class="text-xs font-medium text-indigo-950">{{ t('missing.buildingResolve.condition') }}</label>
              <select v-model="rf.condition" class="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm">
                <option value="safe">{{ t('missing.conditionSafe') }}</option>
                <option value="damaged">{{ t('missing.conditionDamaged') }}</option>
                <option value="collapsed">{{ t('missing.conditionCollapsed') }}</option>
                <option value="unknown">{{ t('missing.conditionUnknown') }}</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-indigo-950">{{ t('missing.buildingResolve.note') }}</label>
              <textarea v-model="rf.note" :placeholder="t('missing.buildingResolve.notePlaceholder')" class="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm" rows="2" />
            </div>

            <div class="flex gap-2">
              <BaseButton :disabled="!rf.note" @click="confirmResolveBuilding(r.id)">{{ t('missing.buildingResolve.confirm') }}</BaseButton>
              <BaseButton variant="neutral" @click="resolveFor = null">{{ t('missing.form.cancel') }}</BaseButton>
            </div>
          </div>
        </li>
      </ul>
    </template>
    </div>
  </div>
</template>

<style scoped>
.people-page {
  background: var(--screen);
  min-height: 100%;
  padding-bottom: 40px;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.wrap {
  margin: 0 auto;
  padding: 12px 16px 24px;
}

/* Custom override classes to apply supply-theme styling */
:deep(.bg-white) {
  background-color: var(--card) !important;
}
:deep(.ring-slate-200), :deep(.ring-1) {
  border: 1.5px solid var(--line) !important;
  --tw-ring-color: transparent !important;
  box-shadow: none !important;
}
:deep(.text-slate-900), :deep(.text-slate-800) {
  color: var(--ink) !important;
}
:deep(.text-slate-700), :deep(.text-slate-600), :deep(.text-slate-500) {
  color: var(--ink2) !important;
}
:deep(.bg-slate-100) {
  background-color: #ECE7DF !important;
}
:deep(.bg-slate-50) {
  background-color: #F6F4EF !important;
}
:deep(.border-slate-300), :deep(.border-indigo-200) {
  border-color: var(--line) !important;
}
:deep(input), :deep(textarea), :deep(select) {
  border-radius: 12px !important;
  font-family: inherit !important;
  outline: none !important;
}
:deep(input:focus), :deep(textarea:focus), :deep(select:focus) {
  border-color: var(--primary) !important;
}
:deep(.bg-amber-50) {
  background-color: var(--amber-bg) !important;
  color: var(--amber-c) !important;
  border: 1.5px solid var(--line) !important;
}
:deep(.text-amber-900) {
  color: var(--amber-c) !important;
}
:deep(.bg-emerald-50), :deep(.bg-emerald-100) {
  background-color: var(--green-bg) !important;
  color: var(--green-c) !important;
  border: 1.5px solid var(--line) !important;
}
:deep(.text-emerald-700), :deep(.text-emerald-800) {
  color: var(--green-c) !important;
}
:deep(.bg-indigo-50), :deep(.bg-indigo-50\/50) {
  background-color: #F3F6FD !important;
  border: 1.5px solid var(--line) !important;
}
:deep(.text-indigo-950), :deep(.text-indigo-900) {
  color: var(--primary) !important;
}
</style>
