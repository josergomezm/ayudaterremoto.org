<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useSessionStore } from '../stores/session'
import MaterialIcon from './MaterialIcon.vue'

const { t } = useI18n()
const session = useSessionStore()

// Dismiss per-session (reappears on page refresh until verified)
const dismissed = ref(false)

const variant = computed(() => {
  if (!session.isVerified) return 'unverified'
  if (session.role === 'colaborador') return 'colaborador'
  return null // coordinador and above: no banner
})

const config = computed(() => {
  if (!variant.value) return null
  return {
    heading:    t(`onboarding.${variant.value}.heading`),
    body:       t(`onboarding.${variant.value}.body`),
    cta:        t(`onboarding.${variant.value}.cta`),
    ctaTo:      '/verify',
    icon:       variant.value === 'unverified' ? 'lock_person' : 'verified_user',
    accent:     variant.value === 'unverified' ? 'amber' : 'indigo',
  }
})

const show = computed(() => !dismissed.value && !!variant.value)
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="show && config"
      class="mx-4 mt-4 rounded-2xl p-4 ring-1"
      :class="config.accent === 'amber'
        ? 'bg-amber-50 ring-amber-200'
        : 'bg-indigo-50 ring-indigo-200'"
    >
      <div class="flex items-start gap-3">
        <span
          class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          :class="config.accent === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'"
        >
          <MaterialIcon :name="config.icon" :size="20" />
        </span>

        <div class="min-w-0 flex-1 space-y-1">
          <p
            class="text-sm font-semibold"
            :class="config.accent === 'amber' ? 'text-amber-900' : 'text-indigo-900'"
          >
            {{ config.heading }}
          </p>
          <p
            class="text-xs leading-relaxed"
            :class="config.accent === 'amber' ? 'text-amber-800/80' : 'text-indigo-800/80'"
          >
            {{ config.body }}
          </p>
          <RouterLink
            :to="config.ctaTo"
            class="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
            :class="config.accent === 'amber' ? 'text-amber-900' : 'text-indigo-900'"
          >
            {{ config.cta }}
            <MaterialIcon name="arrow_forward" :size="14" />
          </RouterLink>
        </div>

        <button
          class="shrink-0 rounded-lg p-1 transition"
          :class="config.accent === 'amber'
            ? 'text-amber-600 hover:bg-amber-100'
            : 'text-indigo-600 hover:bg-indigo-100'"
          :aria-label="t('onboarding.dismiss')"
          @click="dismissed = true"
        >
          <MaterialIcon name="close" :size="18" />
        </button>
      </div>
    </div>
  </Transition>
</template>
