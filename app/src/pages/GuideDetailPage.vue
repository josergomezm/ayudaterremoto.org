<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { findGuide } from '../lib/guides'
import MaterialIcon from '../components/MaterialIcon.vue'
import BaseButton from '../components/BaseButton.vue'

const { t, tm, rt } = useI18n()
const route = useRoute()
const router = useRouter()

const id = computed(() => String(route.params.id))
const guide = computed(() => findGuide(id.value))

// tm() returns the raw message array; rt() renders each entry.
function list(key: string): unknown[] {
  return guide.value ? (tm(`guides.${id.value}.${key}`) as unknown[]) : []
}
const steps = computed(() => list('steps'))

// Color-coded groups for the building-damage assessment layout.
const groups = computed(() => [
  { key: 'avoid', titleKey: 'guides.structural.avoidTitle', icon: 'dangerous', cls: 'bg-red-50 ring-red-200', dot: 'text-red-600', items: list('avoid') },
  { key: 'caution', titleKey: 'guides.structural.cautionTitle', icon: 'warning', cls: 'bg-amber-50 ring-amber-200', dot: 'text-amber-600', items: list('caution') },
  { key: 'ok', titleKey: 'guides.structural.okTitle', icon: 'check_circle', cls: 'bg-emerald-50 ring-emerald-200', dot: 'text-emerald-600', items: list('ok') },
])
</script>

<template>
  <div v-if="guide" class="mx-auto  space-y-5 p-4">
    <button class="flex items-center gap-1 text-sm font-semibold text-slate-500" @click="router.back()">
      <MaterialIcon name="arrow_back" :size="18" /> {{ t('common.back') }}
    </button>

    <header class="flex items-center gap-3">
      <!-- HERO TARGET: same names as the list tile → morphs in -->
      <span
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white"
        :style="{ viewTransitionName: 'guide-' + guide.id }"
      >
        <MaterialIcon :name="guide.icon" :size="30" />
      </span>
      <div>
        <h1
          class="text-2xl font-bold text-slate-900"
          :style="{ viewTransitionName: 'guide-title-' + guide.id }"
        >{{ t('guides.' + guide.id + '.title') }}</h1>
        <p class="text-sm text-slate-600">{{ t('guides.' + guide.id + '.summary') }}</p>
      </div>
    </header>

    <!-- ── ASSESSMENT layout (building-damage self-check) ──────────────── -->
    <template v-if="guide.format === 'assessment'">
      <p class="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{{ t('guides.structural.intro') }}</p>
      <p class="rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        <strong>{{ t('guides.structural.principleLabel') }}:</strong> {{ t('guides.structural.principle') }}
      </p>

      <section v-for="g in groups" :key="g.key" class="space-y-2 rounded-2xl p-4 ring-1" :class="g.cls">
        <h2 class="flex items-center gap-2 font-bold text-slate-900">
          <MaterialIcon :name="g.icon" :size="20" /> {{ t(g.titleKey) }}
        </h2>
        <ul class="space-y-1.5">
          <li v-for="(item, i) in g.items" :key="i" class="flex gap-2 text-sm text-slate-800">
            <MaterialIcon name="chevron_right" :size="18" :class="g.dot" /> {{ rt(item as string) }}
          </li>
        </ul>
      </section>

      <p class="flex gap-2 rounded-xl bg-slate-900 p-3 text-sm font-medium text-white">
        <MaterialIcon name="restart_alt" :size="20" /> {{ t('guides.structural.recheck') }}
      </p>
    </template>

    <!-- ── STEPS layout (all other guides) ─────────────────────────────── -->
    <ol v-else class="space-y-3">
      <li v-for="(step, idx) in steps" :key="idx" class="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          {{ idx + 1 }}
        </span>
        <span class="text-slate-800">{{ rt(step as string) }}</span>
      </li>
    </ol>

    <p class="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{{ t('guides.disclaimer') }}</p>
  </div>

  <div v-else class="space-y-4 p-8 text-center">
    <p class="text-slate-500">{{ t('guides.notFound') }}</p>
    <RouterLink to="/guides"><BaseButton>{{ t('guides.title') }}</BaseButton></RouterLink>
  </div>
</template>
