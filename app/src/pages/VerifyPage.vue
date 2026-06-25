<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import BaseButton from '../components/BaseButton.vue'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()

const nac = ref<'V' | 'E'>('V')
const dni = ref('')
const challengeId = ref<string | null>(null)
const options = ref<string[]>([])
const selected = ref<string | null>(null)
const hint = ref<string | null>(null)
const vouchCode = ref('')
const message = ref<string | null>(null)
const busy = ref(false)
const notRegistered = ref(false)

async function doLookup() {
  busy.value = true
  message.value = null
  notRegistered.value = false
  const res = await session.lookup(nac.value, dni.value)
  busy.value = false
  if (res.ok) {
    challengeId.value = res.challengeId!
    options.value = res.options!
    hint.value = res.hint ?? null
  } else if (res.notRegistered) {
    notRegistered.value = true
    message.value = t('verify.notRegistered')
  } else {
    message.value = res.error ?? null
  }
}

async function doConfirm() {
  if (!challengeId.value || !selected.value) return
  busy.value = true
  message.value = null
  const res = await session.confirm(challengeId.value, selected.value, vouchCode.value)
  busy.value = false
  if (res.ok) {
    router.push('/')
  } else {
    // Single attempt per challenge → reset to lookup with a cooldown message.
    message.value = t('verify.failed')
    challengeId.value = null
    options.value = []
    selected.value = null
  }
}
</script>

<template>
  <div class="mx-auto  space-y-5 p-4">
    <h1 class="text-xl font-bold text-slate-900">{{ t('verify.title') }}</h1>
    <p class="text-sm text-slate-600">{{ t('verify.intro') }}</p>

    <p v-if="message" class="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{{ message }}</p>

    <!-- Step 1 — Cédula lookup -->
    <section v-if="!challengeId" class="space-y-4">
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-slate-800">{{ t('verify.nationality') }}</label>
        <div class="flex gap-2">
          <BaseButton :variant="nac === 'V' ? 'primary' : 'neutral'" @click="nac = 'V'">V</BaseButton>
          <BaseButton :variant="nac === 'E' ? 'primary' : 'neutral'" @click="nac = 'E'">E</BaseButton>
        </div>
      </div>
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-slate-800">{{ t('verify.cedula') }}</label>
        <input
          v-model="dni"
          inputmode="numeric"
          :placeholder="t('verify.cedulaPlaceholder')"
          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-lg"
        />
      </div>
      <BaseButton block :disabled="busy || dni.length < 6" @click="doLookup">{{ t('verify.lookup') }}</BaseButton>
    </section>

    <!-- Step 2 — name-match grid (4×5) + optional vouch code -->
    <section v-else class="space-y-4">
      <h2 class="font-semibold text-slate-700">{{ t('verify.namePrompt') }}</h2>
      <p v-if="hint" class="rounded-lg bg-fuchsia-50 px-3 py-2 text-xs font-medium text-fuchsia-800 ring-1 ring-fuchsia-200">
        {{ t('verify.devHint', { name: hint }) }}
      </p>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          v-for="opt in options"
          :key="opt"
          class="rounded-xl border px-2 py-3 text-sm font-medium"
          :class="selected === opt ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'"
          @click="selected = opt"
        >
          {{ opt }}
        </button>
      </div>

      <div class="space-y-1.5 border-t border-slate-200 pt-4">
        <label class="text-sm font-medium text-slate-800">{{ t('verify.vouchPrompt') }}</label>
        <p class="text-xs text-slate-500">{{ t('verify.vouchHint') }}</p>
        <input
          v-model="vouchCode"
          :placeholder="t('verify.vouchPlaceholder')"
          class="w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase"
        />
      </div>

      <BaseButton block :disabled="busy || !selected" @click="doConfirm">{{ t('verify.confirm') }}</BaseButton>
    </section>
  </div>
</template>
