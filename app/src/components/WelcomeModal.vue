<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MaterialIcon from './MaterialIcon.vue'
import BaseButton from './BaseButton.vue'

const STORAGE_KEY = 'ayudaterremoto.welcomed'

const emit = defineEmits<{ close: [] }>()

const { t, tm, rt } = useI18n()
const router = useRouter()

const slide = ref(0)
const TOTAL = 3

function next() { if (slide.value < TOTAL - 1) slide.value++ }
function back() { if (slide.value > 0) slide.value-- }

function dismiss() {
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
  emit('close')
}

function goVerify() {
  dismiss()
  router.push('/verify')
}

// Slide 2 tabs data
const tabs = computed(() => [
  { icon: 'map',         key: 'map'     },
  { icon: 'add_circle',  key: 'report'  },
  { icon: 'campaign',    key: 'alerts'  },
  { icon: 'menu_book',   key: 'guides'  },
  { icon: 'person_search', key: 'people' },
])

// Slide 3 roles data
const roles = computed(() => [
  { key: 'unverified', icon: 'person',           color: 'text-slate-400', bg: 'bg-slate-100' },
  { key: 'civilian',   icon: 'person_check',      color: 'text-blue-600',  bg: 'bg-blue-50'   },
  { key: 'responder',  icon: 'emergency_home',    color: 'text-amber-600', bg: 'bg-amber-50'  },
  { key: 'authority',  icon: 'badge',             color: 'text-indigo-600',bg: 'bg-indigo-50' },
  { key: 'command',    icon: 'military_tech',     color: 'text-rose-600',  bg: 'bg-rose-50'   },
])

const slide3Roles = tm('welcome.slide3.roles') as Record<string, { name: string; desc: string }>
const slide2Tabs  = tm('welcome.slide2.tabs')  as Record<string, { title: string; desc: string }>
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      :aria-label="t('welcome.slide' + (slide + 1) + '.heading')"
    >
      <div class="relative flex w-full max-w-md flex-col overflow-y-auto rounded-3xl bg-white shadow-2xl max-h-[90dvh]">

        <!-- Skip button (slides 1 & 2 only) -->
        <button
          v-if="slide < 2"
          class="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="dismiss"
        >
          <MaterialIcon name="close" :size="20" />
        </button>

        <!-- ── SLIDE 1 — What the app is ── -->
        <div v-if="slide === 0" class="flex flex-col gap-5 p-8">
          <!-- Icon -->
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg">
            <MaterialIcon name="emergency_home" :size="34" />
          </div>

          <div class="space-y-2">
            <p class="text-xs font-bold uppercase tracking-widest text-rose-600">{{ t('welcome.slide1.label') }}</p>
            <h2 class="text-2xl font-bold leading-tight text-slate-900">{{ t('welcome.slide1.heading') }}</h2>
            <p class="text-sm leading-relaxed text-slate-600">{{ t('welcome.slide1.body') }}</p>
          </div>

          <BaseButton block @click="next">
            {{ t('welcome.next') }} <MaterialIcon name="arrow_forward" :size="18" class="ml-1 inline-block" />
          </BaseButton>
        </div>

        <!-- ── SLIDE 2 — What you can do ── -->
        <div v-else-if="slide === 1" class="flex flex-col gap-5 p-8">
          <div class="space-y-1">
            <p class="text-xs font-bold uppercase tracking-widest text-rose-600">{{ t('welcome.slide2.label') }}</p>
            <h2 class="text-xl font-bold text-slate-900">{{ t('welcome.slide2.heading') }}</h2>
          </div>

          <ul class="space-y-3">
            <li
              v-for="tab in tabs"
              :key="tab.key"
              class="flex items-start gap-3"
            >
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <MaterialIcon :name="tab.icon" :size="18" />
              </span>
              <span class="min-w-0 pt-0.5">
                <span class="block text-sm font-semibold text-slate-900">{{ rt(slide2Tabs[tab.key].title) }}</span>
                <span class="block text-xs text-slate-500">{{ rt(slide2Tabs[tab.key].desc) }}</span>
              </span>
            </li>
          </ul>

          <div class="flex gap-2">
            <button
              class="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              @click="back"
            >
              <MaterialIcon name="arrow_back" :size="16" /> {{ t('welcome.back') }}
            </button>
            <BaseButton class="flex-1" @click="next">
              {{ t('welcome.next') }} <MaterialIcon name="arrow_forward" :size="18" class="ml-1 inline-block" />
            </BaseButton>
          </div>
        </div>

        <!-- ── SLIDE 3 — Roles ── -->
        <div v-else class="flex flex-col gap-4 p-8">
          <div class="space-y-1">
            <p class="text-xs font-bold uppercase tracking-widest text-rose-600">{{ t('welcome.slide3.label') }}</p>
            <h2 class="text-xl font-bold text-slate-900">{{ t('welcome.slide3.heading') }}</h2>
            <p class="text-xs text-slate-500">{{ t('welcome.slide3.intro') }}</p>
          </div>

          <!-- Role ladder -->
          <ul class="space-y-2">
            <li
              v-for="r in roles"
              :key="r.key"
              class="flex items-start gap-3 rounded-xl p-2.5 ring-1 ring-slate-100"
            >
              <span :class="['flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.bg, r.color]">
                <MaterialIcon :name="r.icon" :size="18" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-slate-800">{{ rt(slide3Roles[r.key].name) }}</span>
                <span class="block text-xs leading-snug text-slate-500">{{ rt(slide3Roles[r.key].desc) }}</span>
              </span>
            </li>
          </ul>

          <!-- CTAs -->
          <BaseButton block @click="goVerify">{{ t('welcome.slide3.ctaPrimary') }}</BaseButton>
          <button
            class="w-full rounded-xl py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
            @click="dismiss"
          >
            {{ t('welcome.slide3.ctaSecondary') }}
          </button>
        </div>

        <!-- Progress dots -->
        <div class="flex items-center justify-center gap-2 pb-6">
          <button
            v-for="n in TOTAL"
            :key="n"
            class="h-2 rounded-full transition-all"
            :class="slide === n - 1 ? 'w-6 bg-rose-600' : 'w-2 bg-slate-200'"
            :aria-label="t('welcome.dotAria', { n })"
            @click="slide = n - 1"
          />
        </div>

      </div>
    </div>
  </Teleport>
</template>
