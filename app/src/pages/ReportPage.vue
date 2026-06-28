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
import LocationPickerMap from '../components/LocationPickerMap.vue'

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

const structuralDamage = ref<'minor' | 'moderate' | 'severe' | 'collapse' | ''>('')
const resourceType = ref<'water' | 'food' | 'medical' | 'shelter' | 'tools' | 'other' | ''>('')
const medicalCount = ref<'1' | '2-5' | '6-10' | '10+' | ''>('')
const obstructionType = ref<'landslide' | 'debris' | 'trees' | 'vehicles' | 'other' | ''>('')

const categories: Category[] = ['medical', 'structural', 'obstruction', 'resource']

// Triage questions depend on the chosen category.
const questions = computed(() => (category.value ? TRIAGE_QUESTIONS[category.value] : []))

const showMissingQuestionnaire = computed(() => {
  if (!isProxy.value) return false
  if (category.value === 'medical' && (answers.value['trapped'] === true || answers.value['deceased'] === true)) return true
  if (category.value === 'structural' && answers.value['trapped'] === true) return true
  if (category.value === 'obstruction' && answers.value['trapping'] === true) return true
  return false
})

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
    subjectName: showMissingQuestionnaire.value && subjectName.value ? subjectName.value : undefined,
    subjectDetails: showMissingQuestionnaire.value && subjectDetails.value ? subjectDetails.value : undefined,
    lastSeen: showMissingQuestionnaire.value && lastSeen.value ? lastSeen.value : undefined,
    contact: showMissingQuestionnaire.value && contact.value ? contact.value : undefined,
    structuralDamage: category.value === 'structural' && structuralDamage.value ? structuralDamage.value : undefined,
    resourceType: category.value === 'resource' && resourceType.value ? resourceType.value : undefined,
    medicalCount: category.value === 'medical' && medicalCount.value ? medicalCount.value : undefined,
    obstructionType: category.value === 'obstruction' && obstructionType.value ? obstructionType.value : undefined,
  })
  // Optionally also add the person to the public missing-persons list.
  if (showMissingQuestionnaire.value && asMissing.value && subjectName.value) {
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
  <div class="supply-theme report-page">
    <div class="wrap space-y-5">
      <h1 class="text-xl font-extrabold text-[var(--ink)] tracking-tight">{{ t('report.title') }}</h1>

      <!-- Must be verified to report -->
      <div v-if="!session.isVerified" class="space-y-3 rounded-2xl bg-[var(--amber-bg)] border border-[var(--line)] p-5">
        <p class="text-xs text-[var(--amber-c)] font-semibold leading-relaxed">{{ t('report.needVerify') }}</p>
        <RouterLink to="/profile"><BaseButton block>{{ t('verify.title') }}</BaseButton></RouterLink>
      </div>

      <!-- Success -->
      <div v-else-if="result" class="space-y-4 rounded-2xl bg-[var(--green-bg)] border border-[var(--line)] p-6 text-center">
        <p class="text-base font-bold text-[var(--green-c)]">
          {{ result === 'queued' ? t('report.queuedOffline') : t('report.submitted') }}
        </p>
        <BaseButton block @click="router.push('/')">{{ t('notFound.goHome') }}</BaseButton>
      </div>

      <template v-else>
        <!-- Step 0 — who -->
        <section v-if="step === 0" class="space-y-3">
          <h2 class="text-xs font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('report.who') }}</h2>
          <BaseButton block variant="neutral" @click="isProxy = false; step = 1">{{ t('report.self') }}</BaseButton>
          <BaseButton block variant="neutral" @click="isProxy = true; step = 1">{{ t('report.other') }}</BaseButton>

          <!-- Shortcut to the missing-persons flow -->
          <RouterLink
            to="/people"
            class="mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[#F6F4EF]"
          >
            <MaterialIcon name="person_search" :size="20" class="text-[var(--primary)]" />
            {{ t('report.missingPersonCta') }}
          </RouterLink>
        </section>

        <!-- Step 1 — category -->
        <section v-else-if="step === 1" class="space-y-3">
          <h2 class="text-xs font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('report.category') }}</h2>
          <BaseButton
            v-for="c in categories"
            :key="c"
            block
            :variant="category === c ? 'primary' : 'neutral'"
            @click="category = c; step = 2"
          >
            {{ t('category.' + c) }}
          </BaseButton>
          <BaseButton block variant="neutral" class="mt-2" @click="step = 0">
            <span class="inline-flex items-center gap-1"><MaterialIcon name="arrow_back" :size="18" /> {{ t('common.back') }}</span>
          </BaseButton>
        </section>

        <!-- Step 2 — category-specific triage (one question per row, big yes/no) -->
        <section v-else-if="step === 2" class="space-y-4">
          <h2 class="text-xs font-bold text-[var(--ink2)] uppercase tracking-wider">{{ t('report.triageTitle') }}</h2>
          <div v-for="q in questions" :key="q.id" class="space-y-1.5 p-4 rounded-xl bg-white border border-[var(--line)]">
            <p class="text-xs font-bold text-[var(--ink)] leading-relaxed">{{ t(q.labelKey) }}</p>
            <div class="flex gap-2 mt-2">
              <BaseButton class="flex-1" :variant="answers[q.id] === true ? 'primary' : 'neutral'" @click="answer(q.id, true)">{{ t('common.yes') }}</BaseButton>
              <BaseButton class="flex-1" :variant="answers[q.id] === false ? 'primary' : 'neutral'" @click="answer(q.id, false)">{{ t('common.no') }}</BaseButton>
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <BaseButton variant="neutral" @click="step = 1">
              <span class="inline-flex items-center gap-1"><MaterialIcon name="arrow_back" :size="18" /> {{ t('common.back') }}</span>
            </BaseButton>
            <BaseButton class="flex-1" @click="step = 3">{{ t('common.next') }}</BaseButton>
          </div>
        </section>

        <!-- Step 3 — person details (proxy) + location + context -->
        <section v-else-if="step === 3" class="space-y-4">
          <!-- Guided person fields when reporting for someone else -->
          <div v-if="showMissingQuestionnaire" class="space-y-3 card">
            <h2 class="text-xs font-bold text-[var(--ink2)] uppercase tracking-wider mb-1">{{ t('report.personHeading') }}</h2>
            <div class="space-y-1">
              <label class="text-xs font-bold text-[var(--ink)]">{{ t('report.subjectName') }}</label>
              <input v-model="subjectName" :placeholder="t('report.subjectPlaceholder')" class="input-field" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-[var(--ink)]">{{ t('report.subjectDetails') }}</label>
              <input v-model="subjectDetails" :placeholder="t('report.subjectDetailsPlaceholder')" class="input-field" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-[var(--ink)]">{{ t('report.lastSeen') }}</label>
              <input v-model="lastSeen" :placeholder="t('report.lastSeenPlaceholder')" class="input-field" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-[var(--ink)]">{{ t('report.contact') }} <span class="text-slate-400">({{ t('common.optional') }})</span></label>
              <input v-model="contact" :placeholder="t('report.contactPlaceholder')" class="input-field" />
            </div>
            <label class="flex items-center gap-2 text-xs font-bold text-[var(--ink)] pt-1 select-none">
              <input v-model="asMissing" type="checkbox" class="h-4.5 w-4.5 rounded border-[var(--line)] text-[var(--primary)]" />
              {{ t('report.asMissing') }}
            </label>
          </div>

          <div class="space-y-3">
            <h2 class="text-xs font-bold text-[var(--ink2)] uppercase tracking-wider">{{ showMissingQuestionnaire ? t('report.lastKnownLocation') : t('report.location') }}</h2>
            <BaseButton block variant="neutral" :disabled="locating" @click="useMyLocation">
              <span class="inline-flex items-center justify-center gap-1.5 font-bold">
                <MaterialIcon :name="locationPrecise && lat !== null ? 'check_circle' : 'my_location'" :size="18" />
                {{ locating ? t('report.locating') : (lat !== null && locationPrecise ? t('report.pinSet') : t('report.dropPin')) }}
              </span>
            </BaseButton>

            <LocationPickerMap
              :lat="lat"
              :lng="lng"
              @update:location="({ lat: newLat, lng: newLng }) => { lat = newLat; lng = newLng; locationPrecise = true }"
            />
            <p class="text-[10px] font-semibold text-[var(--ink2)] text-center">
              {{ t('report.mapInstruction') }}
            </p>
          </div>

          <!-- Category-Specific Fields (Gaps Resolution) -->
          <div v-if="category === 'structural'" class="space-y-1">
            <label class="text-xs font-bold text-[var(--ink)]">{{ t('category.structuralDamageLabel') }}</label>
            <select v-model="structuralDamage" class="input-field">
              <option value="">{{ t('category.selectDamage') }}</option>
              <option value="minor">{{ t('category.damageValues.minor') }}</option>
              <option value="moderate">{{ t('category.damageValues.moderate') }}</option>
              <option value="severe">{{ t('category.damageValues.severe') }}</option>
              <option value="collapse">{{ t('category.damageValues.collapse') }}</option>
            </select>
          </div>

          <div v-if="category === 'resource'" class="space-y-1">
            <label class="text-xs font-bold text-[var(--ink)]">{{ t('category.resourceTypeLabel') }}</label>
            <select v-model="resourceType" class="input-field">
              <option value="">{{ t('category.selectResource') }}</option>
              <option value="water">{{ t('category.resourceValues.water') }}</option>
              <option value="food">{{ t('category.resourceValues.food') }}</option>
              <option value="medical">{{ t('category.resourceValues.medical') }}</option>
              <option value="shelter">{{ t('category.resourceValues.shelter') }}</option>
              <option value="tools">{{ t('category.resourceValues.tools') }}</option>
              <option value="other">{{ t('category.resourceValues.other') }}</option>
            </select>
          </div>

          <div v-if="category === 'medical'" class="space-y-1">
            <label class="text-xs font-bold text-[var(--ink)]">{{ t('category.medicalCountLabel') }}</label>
            <select v-model="medicalCount" class="input-field">
              <option value="">{{ t('category.selectCount') }}</option>
              <option value="1">{{ t('category.medicalCountValues.1') }}</option>
              <option value="2-5">{{ t('category.medicalCountValues.2-5') }}</option>
              <option value="6-10">{{ t('category.medicalCountValues.6-10') }}</option>
              <option value="10+">{{ t('category.medicalCountValues.10+') }}</option>
            </select>
          </div>

          <div v-if="category === 'obstruction'" class="space-y-1">
            <label class="text-xs font-bold text-[var(--ink)]">{{ t('category.obstructionTypeLabel') }}</label>
            <select v-model="obstructionType" class="input-field">
              <option value="">{{ t('category.selectObstruction') }}</option>
              <option value="landslide">{{ t('category.obstructionValues.landslide') }}</option>
              <option value="debris">{{ t('category.obstructionValues.debris') }}</option>
              <option value="trees">{{ t('category.obstructionValues.trees') }}</option>
              <option value="vehicles">{{ t('category.obstructionValues.vehicles') }}</option>
              <option value="other">{{ t('category.obstructionValues.other') }}</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-[var(--ink)]">{{ t('report.unit') }} <span class="text-slate-400">({{ t('common.optional') }})</span></label>
            <input v-model="unit" :placeholder="t('report.unitPlaceholder')" class="input-field" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-[var(--ink)]">{{ t('report.description') }}</label>
            <textarea v-model="description" :placeholder="t('report.descriptionPlaceholder')" rows="3" class="input-field" />
          </div>

          <div class="flex gap-2">
            <BaseButton variant="neutral" @click="step = 2">
              <span class="inline-flex items-center gap-1"><MaterialIcon name="arrow_back" :size="18" /> {{ t('common.back') }}</span>
            </BaseButton>
            <BaseButton class="flex-1" :disabled="lat === null" @click="submit">{{ t('report.submit') }}</BaseButton>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.report-page {
  background: var(--screen);
  min-height: 100%;
  padding-bottom: 40px;
}
.wrap {
  margin: 0 auto;
  padding: 12px 16px 24px;
}
.card {
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: 20px;
  padding: 18px;
}
.input-field {
  width: 100%;
  border: 1.5px solid var(--line);
  background: #fff;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink);
  outline: none;
}
.input-field:focus {
  border-color: var(--primary);
}
</style>
