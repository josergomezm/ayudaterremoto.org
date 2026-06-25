<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, RouterLink } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { useIncidentsStore, type Category } from '../stores/incidents'
import { useMissingStore } from '../stores/missing'
import { TRIAGE_QUESTIONS, computeLevel } from '../lib/triage'
import BaseButton from '../components/BaseButton.vue'
import MaterialIcon from '../components/MaterialIcon.vue'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const store = useIncidentsStore()
const missing = useMissingStore()

// Panic-proof flow: one decision per screen, large targets, minimal required input.
const step = ref(0)
const isProxy = ref(false)
const category = ref<Category | null>(null)
const answers = ref<Record<string, boolean>>({})
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const locationPrecise = ref(false)
const unit = ref('')
const locating = ref(false)
const subjectName = ref('')
const subjectDetails = ref('')
const lastSeen = ref('')
const contact = ref('')
const asMissing = ref(false)
const description = ref('')
const result = ref<'submitted' | 'queued' | null>(null)

const categories: Category[] = ['medical', 'structural', 'obstruction', 'resource']

// Triage questions depend on the chosen category.
const questions = computed(() => (category.value ? TRIAGE_QUESTIONS[category.value] : []))

function answer(id: string, val: boolean) {
  answers.value[id] = val
}

// Standardized triage level (1 critical … 5 minor) from category-specific answers.
const triageLevel = computed(() => (category.value ? computeLevel(category.value, answers.value) : 4))

function useMyLocation() {
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => { lat.value = pos.coords.latitude; lng.value = pos.coords.longitude; locationPrecise.value = true; locating.value = false },
    () => { lat.value = 10.5; lng.value = -66.91; locationPrecise.value = false; locating.value = false }, // fallback (Caracas) — NOT precise, won't auto-cluster
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

async function submit() {
  if (!category.value || lat.value === null || lng.value === null) return
  const res = await store.submitReport({
    type: isProxy.value ? 'proxy' : 'personal',
    category: category.value,
    triageLevel: triageLevel.value,
    lat: lat.value,
    lng: lng.value,
    locationPrecise: locationPrecise.value,
    unit: unit.value || undefined,
    description: description.value || '—',
    subjectName: isProxy.value && subjectName.value ? subjectName.value : undefined,
    subjectDetails: isProxy.value && subjectDetails.value ? subjectDetails.value : undefined,
    lastSeen: isProxy.value && lastSeen.value ? lastSeen.value : undefined,
    contact: isProxy.value && contact.value ? contact.value : undefined,
  })
  // Optionally also add the person to the public missing-persons list.
  if (isProxy.value && asMissing.value && subjectName.value) {
    await missing.report({
      name: subjectName.value,
      details: subjectDetails.value || undefined,
      lastSeen: lastSeen.value || undefined,
      lat: lat.value ?? undefined,
      lng: lng.value ?? undefined,
      contactPhone: contact.value || undefined,
    })
  }
  result.value = res.queued ? 'queued' : 'submitted'
}
</script>

<template>
  <div class="mx-auto  space-y-5 p-4">
    <h1 class="text-xl font-bold text-slate-900">{{ t('report.title') }}</h1>

    <!-- Must be verified to report -->
    <div v-if="!session.isVerified" class="space-y-3 rounded-xl bg-amber-50 p-4">
      <p class="text-sm text-amber-900">{{ t('report.needVerify') }}</p>
      <RouterLink to="/verify"><BaseButton>{{ t('verify.title') }}</BaseButton></RouterLink>
    </div>

    <!-- Success -->
    <div v-else-if="result" class="space-y-4 rounded-xl bg-emerald-50 p-4 text-center">
      <p class="text-lg font-semibold text-emerald-800">
        {{ result === 'queued' ? t('report.queuedOffline') : t('report.submitted') }}
      </p>
      <BaseButton block @click="router.push('/')">{{ t('notFound.goHome') }}</BaseButton>
    </div>

    <template v-else>
      <!-- Step 0 — who -->
      <section v-if="step === 0" class="space-y-3">
        <h2 class="font-semibold text-slate-700">{{ t('report.who') }}</h2>
        <BaseButton block variant="neutral" @click="isProxy = false; step = 1">{{ t('report.self') }}</BaseButton>
        <BaseButton block variant="neutral" @click="isProxy = true; step = 1">{{ t('report.other') }}</BaseButton>

        <!-- Shortcut to the missing-persons flow -->
        <RouterLink
          to="/missing"
          class="mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
        >
          <MaterialIcon name="person_search" :size="20" /> {{ t('report.missingPersonCta') }}
        </RouterLink>
      </section>

      <!-- Step 1 — category -->
      <section v-else-if="step === 1" class="space-y-3">
        <h2 class="font-semibold text-slate-700">{{ t('report.category') }}</h2>
        <BaseButton
          v-for="c in categories"
          :key="c"
          block
          :variant="category === c ? 'primary' : 'neutral'"
          @click="category = c; step = 2"
        >
          {{ t('category.' + c) }}
        </BaseButton>
      </section>

      <!-- Step 2 — category-specific triage (one question per row, big yes/no) -->
      <section v-else-if="step === 2" class="space-y-4">
        <h2 class="font-semibold text-slate-700">{{ t('report.triageTitle') }}</h2>
        <div v-for="q in questions" :key="q.id" class="space-y-1.5">
          <p class="text-sm font-medium text-slate-800">{{ t(q.labelKey) }}</p>
          <div class="flex gap-2">
            <BaseButton :variant="answers[q.id] === true ? 'primary' : 'neutral'" @click="answer(q.id, true)">{{ t('common.yes') }}</BaseButton>
            <BaseButton :variant="answers[q.id] === false ? 'primary' : 'neutral'" @click="answer(q.id, false)">{{ t('common.no') }}</BaseButton>
          </div>
        </div>
        <BaseButton block @click="step = 3">{{ t('common.submit') }}</BaseButton>
      </section>

      <!-- Step 3 — person details (proxy) + location + context -->
      <section v-else-if="step === 3" class="space-y-4">
        <!-- Guided person fields when reporting for someone else -->
        <div v-if="isProxy" class="space-y-3">
          <h2 class="font-semibold text-slate-700">{{ t('report.personHeading') }}</h2>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('report.subjectName') }}</label>
            <input v-model="subjectName" :placeholder="t('report.subjectPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('report.subjectDetails') }}</label>
            <input v-model="subjectDetails" :placeholder="t('report.subjectDetailsPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('report.lastSeen') }}</label>
            <input v-model="lastSeen" :placeholder="t('report.lastSeenPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-slate-800">{{ t('report.contact') }} <span class="text-slate-400">({{ t('common.optional') }})</span></label>
            <input v-model="contact" :placeholder="t('report.contactPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <label class="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input v-model="asMissing" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
            {{ t('report.asMissing') }}
          </label>
        </div>

        <div class="space-y-2">
          <h2 class="font-semibold text-slate-700">{{ isProxy ? t('report.lastKnownLocation') : t('report.location') }}</h2>
          <BaseButton block variant="neutral" :disabled="locating" @click="useMyLocation">
            <span class="inline-flex items-center justify-center gap-1.5">
              <MaterialIcon :name="lat !== null ? 'check_circle' : 'my_location'" :size="18" />
              {{ locating ? t('report.locating') : (lat !== null ? t('report.pinSet') : t('report.dropPin')) }}
            </span>
          </BaseButton>
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-slate-800">{{ t('report.unit') }} <span class="text-slate-400">({{ t('common.optional') }})</span></label>
          <input v-model="unit" :placeholder="t('report.unitPlaceholder')" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-slate-800">{{ t('report.description') }}</label>
          <textarea v-model="description" :placeholder="t('report.descriptionPlaceholder')" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </div>

        <BaseButton block :disabled="lat === null" @click="submit">{{ t('report.submit') }}</BaseButton>
      </section>
    </template>
  </div>
</template>
